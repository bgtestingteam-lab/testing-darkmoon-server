import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import redis from "../configs/redisConfig";
import { sendMessage, markMessagesSeen } from "../services/chat.service";
import { AuthenticatedSocket, socketAuth } from "../middlewares/auth.socket";
import { User } from "../models/user.model";
import { getAllHostsService, invalidateHostCache } from "../services/user.service";
import { PermissionEngine } from "../utils/permissionEngine";
import { registerVoiceRoomHandlers } from "./voiceRoomSocket";

// Redis Pub/Sub for Adapter
const pubClient = redis;
const subClient = redis.duplicate();

let ioInstance: Server;

// Helper: Get 'room' name for user
export const getUserRoom = (userId: string) => `user:${userId}`;

// Deleted deprecated getSocketIdByUserId


// -------------------- 🔑 Access io Globally --------------------
export const getIOOptional = (): Server | null => {
    return ioInstance || null;
};

export const getIO = (): Server => {
    if (!ioInstance) {
        return null as any;
    }
    return ioInstance;
};

const chatSocket = (io: Server) => {
    ioInstance = io;

    // Setup Redis Adapter
    io.adapter(createAdapter(pubClient, subClient));

    io.use(socketAuth);

    io.on("connection", async (socket: AuthenticatedSocket) => {
        if (!socket.user?.id) {
            console.error('❌ Socket connected without user ID');
            return;
        }

        // Register Voice Room Handlers SYNCHRONOUSLY before any async calls so no early client emits are lost
        registerVoiceRoomHandlers(io, socket);

        const userIdStr = socket.user.id.toString();
        const userRoom = getUserRoom(userIdStr);

        // Join personal rooms for targeting across aliases (_id, numeric userId, meethiId)
        socket.join(userRoom);
        socket.join(`user:${userIdStr}`);
        if (socket.user.userId) socket.join(`user:${socket.user.userId}`);

        // Mark Online in Redis
        await redis.sadd("online_users", userIdStr);
        await redis.set(`socket_user:${socket.id}`, userIdStr); // Map socket -> user for disconnect

        console.log(`✅ User connected: ${userIdStr} | Socket: ${socket.id}`);

        await User.findByIdAndUpdate(socket.user.id, { $set: { isOnline: true } });

        // Invalidate host cache when host comes online
        if (socket.user.role === "host") {
            invalidateHostCache();
        }

        // Join authorized admin/operator roles with verified server-side permission to moderation room
        const canAccessModeration = await PermissionEngine.hasModerationPermission(
            { id: socket.user.id, _id: socket.user.id, role: socket.user.role },
            "view"
        );

        if (canAccessModeration) {
            socket.join("admin_moderation");
            console.log(`🛡️ Admin socket ${socket.id} (user: ${socket.user.id}, role: ${socket.user.role}) joined room admin_moderation`);
        } else {
            console.warn(`🔒 Access Denied: Socket ${socket.id} (user: ${socket.user.id}, role: ${socket.user.role}) denied admin_moderation room access`);
        }

        socket.on("joinModerationRoom", async () => {
            const hasPermission = await PermissionEngine.hasModerationPermission(
                { id: socket.user?.id, _id: socket.user?.id, role: socket.user?.role },
                "view"
            );
            if (hasPermission) {
                socket.join("admin_moderation");
                socket.emit("moderationRoomJoined", { success: true });
            } else {
                console.warn(`🔒 Access Denied: Socket ${socket.id} requested joinModerationRoom without permission`);
                socket.emit("moderationRoomJoined", { success: false, message: "Permission denied" });
            }
        });

        socket.emit("connectionConfirmed", {
            userId: userIdStr,
            socketId: socket.id,
            timestamp: new Date()
        });

        // ------------------ Initial Data ------------------
        if (socket.user.role === "host") {
            const hostsData = await getAllHostsService({
                role: "user",
                page: 1,
                limit: 50,
                userId: String(socket.user.id) // Exclude self
            });
            socket.emit("hostsList", hostsData); // Emit ONLY to the connected host
        } else {
            const hostsData = await getAllHostsService({
                role: "host",
                page: 1,
                limit: 50,
                userId: String(socket.user.id)
            });
            socket.emit("hostsList", hostsData);
        }

        io.emit("userOnline", { userId: userIdStr });

        // ------------------ Chat & Lists ------------------
        socket.on("requestHostsList", async (data: { tab?: string, language?: string } = {}) => {
            const hostsData = await getAllHostsService({
                role: "host", // Everyone sees hosts
                page: 1,
                limit: 50,
                userId: String(socket.user?.id),
                tab: data?.tab,
                language: data?.language
            });
            socket.emit("hostsList", hostsData);
        });


        socket.on("joinConversation", ({ conversationId }: { conversationId: string }) => {
            console.log(`➡️ User ${userIdStr} joining conversation ${conversationId}`);
            socket.join(conversationId);
        });

        socket.on("typing", ({ conversationId }: { conversationId: string }) => {
            socket.to(conversationId).emit("userTyping", { userId: userIdStr });
        });

        socket.on("markSeen", async ({ conversationId }: { conversationId: string }) => {
            await markMessagesSeen(conversationId, socket.user!.id);
            io.to(conversationId).emit("messagesSeen", { conversationId, id: userIdStr });
        });

        socket.on("exitChat", ({ conversationId }: { conversationId: string }) => {
            socket.leave(conversationId);
        });

        socket.on("disconnect", async () => {
            try {
                const uid = userIdStr;
                await redis.srem("online_users", uid);
                await redis.del(`socket_user:${socket.id}`);
                const lastOnline = new Date();
                await User.findByIdAndUpdate(uid, {
                    $set: {
                        lastOnline,
                        isOnline: false,
                        isBusy: false,
                    }
                });

                io.emit("userOffline", { userId: uid, lastOnline });

                if (socket.user?.role === "host") {
                    invalidateHostCache();
                }
                console.log(`👋 User offline: ${uid}`);

            } catch (error) {
                console.error(`Error during disconnect for ${userIdStr}:`, error);
            }
        });
    });
};



export default chatSocket;
// Export onlineUsers to keep other files from crashing, but it is empty/useless now.
export const onlineUsers = {}; 
