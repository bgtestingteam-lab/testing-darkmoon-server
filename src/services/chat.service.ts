import { Types } from "mongoose";
import Conversation, { IConversation } from "../models/conversation.model";
import Message, { IMessage } from "../models/chat.model";
import redis from "../configs/redisConfig";
import { User } from "../models/user.model";

// Send message
export const sendMessage = async ({
    senderId,
    receiverId,
    content,
}: {
    senderId: string | Types.ObjectId;
    receiverId: string | Types.ObjectId;
    content: string;
}): Promise<{ message: IMessage; conversation: IConversation | null }> => {
    // Check if a conversation already exists between users
    let conversation = (await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
    })) as IConversation | null;

    // Create new conversation if none exists
    if (!conversation) {
        conversation = (await Conversation.create({
            participants: [senderId, receiverId],
        })) as IConversation;
    }

    // Save the message
    const message = (await Message.create({
        conversationId: conversation._id,
        sender: senderId,
        receiver: receiverId,
        content,
    })) as IMessage;

    // Update lastMessage in conversation
    conversation.lastMessage = message._id as Types.ObjectId;
    await conversation.save();

    // Populate lastMessage and participants before returning
    const updatedConversation = await Conversation.findById(conversation._id)
        .populate("lastMessage")
        .populate("participants", "name image _id");

    return { message, conversation: updatedConversation };
};

// Get messages by conversationId
export const getMessages = async (
    conversationId: string | Types.ObjectId,
    limit = 50,
    skip = 0
): Promise<IMessage[]> => {
    const convId = new Types.ObjectId(conversationId);
    return await Message.find({ conversationId: convId })
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit);
};

// Get conversation list for a user
export const getConversations = async (
    userId: string | Types.ObjectId
): Promise<any[]> => {
    const uid = new Types.ObjectId(userId);

    const conversations = await Conversation.find({
        participants: uid,
    })
        .populate("participants", "name image _id lastOnline")
        .populate("lastMessage");

    // Fetch Online Users from Redis
    const onlineUserIds = await redis.smembers("online_users");
    const onlineSet = new Set(onlineUserIds);

    const currentUser = await User.findById(uid).select("blockedUsers");
    const myBlocklist = currentUser?.blockedUsers?.map((id: any) => id.toString()) || [];

    // Filter conversations based on blocklists and inject online status
    const filteredConversations = await Promise.all(conversations.map(async (conv) => {
        try {
            const otherParticipant = conv.participants.find((p: any) => p._id.toString() !== uid.toString());

            if (!otherParticipant) return null;

            // Check if blocked by current user
            if (myBlocklist.includes(otherParticipant._id.toString())) {
                return null;
            }

            // Check if other user blocked current user
            const otherUserDoc = await User.findById(otherParticipant._id).select("blockedUsers");
            const theirBlocklist = otherUserDoc?.blockedUsers?.map((id: any) => id.toString()) || [];
            if (theirBlocklist.includes(uid.toString())) {
                return null;
            }

            // Return formatted conversation
            const participantsWithStatus = conv.participants.map((p: any) => ({
                ...p.toObject(),
                isOnline: onlineSet.has(p._id.toString()),
            }));

            // Get unread count for current user
            const unreadCount = await Message.countDocuments({
                conversationId: conv._id,
                receiver: uid,
                status: { $ne: "seen" }
            });

            return {
                ...conv.toObject(),
                participants: participantsWithStatus,
                unreadCount,
            };
        } catch (err) {
            console.error("Error processing conversation filter:", err);
            return null;
        }
    }));

    // Filter out nulls
    return filteredConversations.filter(c => c !== null);
};

// Mark messages seen
export const markMessagesSeen = async (
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
): Promise<void> => {
    const convId = new Types.ObjectId(conversationId);
    const uid = new Types.ObjectId(userId);

    await Message.updateMany(
        { conversationId: convId, receiver: uid, status: { $ne: "seen" } },
        { $set: { status: "seen" } }
    );
};

// Delete seen messages
export const deleteSeenMessages = async (
    conversationId: string | Types.ObjectId,
    userId: string | Types.ObjectId
): Promise<void> => {
    const convId = new Types.ObjectId(conversationId);
    const uid = new Types.ObjectId(userId);

    await Message.deleteMany({
        conversationId: convId,
        receiver: uid,
        status: "seen",
    });
};
