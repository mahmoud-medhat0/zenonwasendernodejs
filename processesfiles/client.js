import qrcode from "qrcode";
import SessionModel from '../models/SessionModel.js';
import WaSendedMessages from '../models/WaSendedMessages.js';
import axios from 'axios';
import { makeWASocket, useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom';
import { unlinkSync } from 'fs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client;
const sessionId = process.argv[2];
if (!sessionId) {
    console.error("Error: sessionId is not provided. Please pass a sessionId as a command line argument.");
    process.exit(1);
}
const sessionsDir = path.join(process.cwd(), 'sessions');
if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
}

async function initializeClient(sessionId) {
    const sessionPath = path.join(sessionsDir, sessionId);
    console.log("sessionPath", sessionPath);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath)
    client = makeWASocket({
        auth: state,
    });
    client.ev.on('creds.update', saveCreds);
    client.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        const {qr}=update;
        if(qr){
            try {
                const qrCodeDataUrl = await qrcode.toDataURL(qr);
                const sessionModel = new SessionModel();
                sessionModel.updateBySessionId(sessionId, "qrcode", qrCodeDataUrl);
                console.log(`New QR RECEIVED for session ${sessionId}`);
            } catch (error) {
                console.log("Error updating QRCODE", error);
            }
        }
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`connection closed for ${sessionId} due to `, lastDisconnect.error, ', reconnecting ', shouldReconnect);
            // Reconnect if not logged out
            if (shouldReconnect) {
                await initializeClient(sessionId);
            } else {
                const sessionModel = new SessionModel();
                sessionModel.updateBySessionId(sessionId, "status", "disconnected");
                sessionModel.updateBySessionId(sessionId, "phone_number", "");
                sessionModel.updateBySessionId(sessionId, "qrcode", "");
                process.send({
                    sessionId,
                    type: "disconnected",
                    message: `Client disconnected: ${lastDisconnect.error}`,
                });
                unlinkSync(sessionPath); // Remove auth files if logged out
                process.exit(); // Terminate the child process when disconnected
            }
        } else if (connection === 'open') {
            console.log(`opened connection for ${sessionId}`);
            const sessionModel = new SessionModel();
            sessionModel.updateBySessionId(sessionId, "status", "readyforsendmessage");
            sessionModel.updateBySessionId(sessionId, "phone_number", client.user?.id || "unknown");
            process.send({
                sessionId,
                type: "ready",
                message: `Client is ready for session ${sessionId}`,
            });
        }
    });
    client.ev.on('messages.upsert', async (m) => {
        console.log(`Message for ${sessionId}:`, JSON.stringify(m, undefined, 2));

        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            await commandMessage(msg);
        }
    });

    // client.on("message_sent", async (message) => {
    //     // await commandMessage(message);
    //     // process.send({ sessionId, type: 'message_sent', message: `Message sent: ${message}` });
    // });

    // client.on("message", async (message) => {
    //     // console.log("message", message.fromMe);
    //     await commandMessage(message);
    // });
    // client.on("message_create", async (message) => {
    //     if (message.fromMe) {
    //         await commandMessage(message);
    //     }
    // });
    // client.initialize();
}

async function retryDestroyAndInitializeClient(retries = 5, delay = 1000) {
    const sessionModel = new SessionModel();
    sessionModel.updateBySessionId(sessionId, "status", "disconnected");
    sessionModel.updateBySessionId(sessionId, "phone_number", "");
    sessionModel.updateBySessionId(sessionId, "qrcode", "");
    await client
        .destroy()
        .then(() => {
            initializeClient();
        })
        .catch((err) => {
            if (retries > 0) {
                console.log(
                    `Retrying to destroy client in ${delay}ms... (${retries} retries left)`
                );
                setTimeout(
                    () => retryDestroyAndInitializeClient(retries - 1, delay),
                    delay
                );
            } else {
                console.log("Failed to destroy client after multiple attempts", err);
            }
        });
}
async function removeAuthFiles(authDirectory, sessionId) {
    try {
        await fs.promises.rm(authDirectory, { recursive: true, force: true });
        console.log(`Session files for ${sessionId} deleted successfully.`);
    } catch (err) {
        console.error(`Failed to delete session files for ${sessionId}:`, err);
    }
}
async function commandMessage(message) {
    const sessionModel = new SessionModel();
    const isActiveSubcription = await sessionModel.checkActiveSubcription(
        sessionId
    );
    const userData = await sessionModel.getUserBySessionId(sessionId);
    const prefix = userData.prefix;
    if (isActiveSubcription) {
        console.log("message", message);
        console.log("message.message.extendedTextMessage.text", message.message.extendedTextMessage.text);
        console.log("prefix", prefix);
        console.log("message.message.extendedTextMessage.text.includes(prefix)", message.message.extendedTextMessage.text.includes(prefix));
        if (message.key.remoteJid.includes("@g.us")) {
            if (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.text.includes("معلومات") && !message.message.extendedTextMessage.text.includes(prefix)) {
                console.log("message", message);
                client
                    .sendMessage("201148422820@c.us", {text:"معلومات : " + message.key.remoteJid})
                    .then(() =>
                        process.send({
                            sessionId,
                            type: "message_sent",
                            message: `Replied to ${message.from} with: ${message.message.extendedTextMessage.text}`,
                        })
                    )
                    .catch((err) =>
                        process.send({
                            sessionId,
                            type: "error",
                            message: `Error replying to message: ${err.message}`,
                        })
                    );
            } else if (message.message && message.message.extendedTextMessage && message.message.extendedTextMessage.text.includes(prefix)) {
                const updateValue = message.message.extendedTextMessage.text.split(prefix)[1].trim();
                const beforeMessage = message.message.extendedTextMessage.text.split(' ')[0];
                console.log("beforeMessage", beforeMessage);
                console.log("updateValue", updateValue);
                const sessionModel = new SessionModel();
                const userData = await sessionModel.getUserBySessionId(sessionId);
                const orginalGroupId = message.key.remoteJid.replace("@g.us", "");
                if (userData.endpoint_api) {
                    axios
                        .post(userData.endpoint_api + "search-orders-data-by-group-id", {
                            group_id: orginalGroupId,
                            search: updateValue,
                            beforeMessage:beforeMessage
                        })
                        .then((response) => {
                            const orders = response.data.orders;
                            let messageData = "";
                            if (Array.isArray(orders)) {
                                if (orders.length == 0) {
                                    messageData = "لا يوجد طلبات بهذة البيانات";
                                } else {
                                    // console.log("orders", orders);
                                    if(response.returnNamedStatusType !=''){
                                        messageData =
                                        "قائمة الطلبات : "+response.data.returnNamedStatusType + " " + response.data.count + " طلب \n";
                                    }else{
                                        messageData =
                                        "قائمة الطلبات : " + response.data.count + " طلب \n";
                                    }
                                    messageData += "-----------------------------------\n";
                                    orders.forEach((order) => {
                                        messageData += `الراسل : ${order.sender}\n`;
                                        messageData += `الرقم المرجعي للراسل : ${order.sender_police}\n`;
                                        messageData += `رقم البوليصة : ${order.id_police}\n`;
                                        messageData += `اسم العميل : ${order.name_client}\n`;
                                        messageData += `رقم الهاتف الاول : ${order.phone}\n`;
                                        messageData += `رقم الهاتف الثاني : ${order.phone2}\n`;
                                        messageData += `المحافظة : ${order.governate_name}\n`;
                                        messageData += `المنطقة : ${order.center_name}\n`;
                                        messageData += `العنوان : ${order.address}\n`;
                                        messageData += `المبلغ : ${order.cost}\n`;
                                        messageData += `الحالة : ${order.status_name}\n`;
                                        messageData += `سبب الارتجاع : ${order.cause_return_cause}\n`;
                                        messageData += "-----------------------------------\n";
                                    });
                                }
                            } else {
                                console.error("Error fetching orders: orders is not an array");
                                messageData = "حدث خطأ ما في جلب الطلبات";
                            }
                            console.log("message", messageData);
                            client
                                .sendMessage(message.key.remoteJid,{text:messageData},{ quoted: message })
                                .then((newMessage) => {
                                    const waSendedMessages = new WaSendedMessages();
                                    waSendedMessages.create({
                                        wa_session_id: sessionId,
                                        message: messageData,
                                        message_id: newMessage.id.id,
                                        phone_number: message.key.remoteJid,
                                    });
                                    process.send({
                                        sessionId,
                                        type: "message_sent",
                                        message: `Replied to ${message.key.remoteJid} with: ${messageData}`,
                                    });
                                })
                                .catch((err) =>
                                    process.send({
                                        sessionId,
                                        type: "error",
                                        message: `Error replying to message: ${err.message}`,
                                    })
                                );
                        })
                        .catch((error) => {
                            console.error("Error fetching orders:", error);
                            client
                                .sendMessage(message.key.remoteJid, {text:"حدث خطأ ما في الرد علي المعلومات"})
                                .catch((err) => console.error("Error sending message:", err));
                        });
                } else {
                    client
                        .sendMessage(message.key.remoteJid, {text:"لا يوجد ايدي المستخدم في البوت"})
                        .catch((err) => console.error("Error sending message:", err));
                }
            }
        }
    }
}
initializeClient(sessionId);

process.on("message", async (message) => {
    const { type, payload } = message;
    let result;
    // console.log(`Received message from parent:`, message);
    switch (type) {
        case "send_message":
            const { to, body } = payload;
            console.log(`Sending message to ${to}: ${body}`);
            return client
                .sendMessage(to, {text:body})
                .then(async (result) => {
                    console.log("result of send message", result.id.id);
                    const waSendedMessages = new WaSendedMessages();
                    await waSendedMessages.create({
                        wa_session_id: sessionId,
                        message: body,
                        message_id: result.id.id,
                        phone_number: to,
                    });
                    process.send({
                        sessionId,
                        type: "message_sent",
                        message: `Message sent to ${to}`,
                    });
                    return {
                        sessionId: sessionId,
                        message: body,
                        phoneNumber: to,
                        status: "sent",
                        messageSent: result,
                    };
                })
                .catch((err) =>
                    process.send({
                        sessionId,
                        type: "error",
                        message: `Error sending message: ${err.message}`,
                    })
                );
            break;
        case "check_number_is_registered":
            let phoneNumber = message.payload;
            process.send({ message: message });
            process.send({
                sessionId,
                type: "phoneNumber",
                message: `Phone number: ${phoneNumber}`,
            });
            if (phoneNumber && phoneNumber.includes("@c.us")) {
                phoneNumber = phoneNumber;
            } else {
                phoneNumber = phoneNumber + "@c.us";
            }
            result = await client.onWhatsApp(phoneNumber);
            process.send({result});
            // return await client
            //     .onWhatsApp(phoneNumber)
            //     .then(async (result) => {
            //         process.send({
            //             sessionId,
            //             type: "number_id",
            //             message: `Number ID: ${result}`,
            //         });
            //         process.send({ result });
            //         return result == null ? false : true;
            //     })
            //     .catch((err) =>
            //         process.send({
            //             sessionId,
            //             type: "error",
            //             message: `Error getting number ID: ${err.message}`,
            //         })
            //     );
            break;
        case "check_I_in_group":
            var groupId = message.payload;
            const groupdata = await client.groupMetadata(groupId);
            result = groupdata ? true : false;
            if (result) {
                process.send({ SendMessageToGroup: groupId });
                console.log(`Client is part of the group: ${groupId}`);
            } else {
                console.log("Client is not part of the group:", groupId);
                return false;
            }
            return result;
            break;
        case "send_message_to_group":
            process.send({payloadInSendMessageGroup: message.payload});
            var {groupId,message} = message.payload;
            try {
                result = await client.sendMessage(message, {text: groupId}).then(async (result)=>{
                    console.log("Message sent to group:", result);
                    const waSendedMessages = new WaSendedMessages();
                    await waSendedMessages.create({
                        wa_session_id: sessionId,
                        message: groupId,
                        message_id: result.id.id,
                        phone_number: message,
                    });
                    return result;
                }).catch((err)=>{
                    process.send({ sessionId, type: "error", message: `Error sending message to group: ${err.message}` });
                    console.error("Error sending message to group:", err);
                    return false;
                });
                console.log("Message sent to group:", result);
                return result;
            } catch (err) {
                process.send({ sessionId, type: "error", message: `Error sending message to group: ${err.message}` });
                console.error("Error sending message to group:", err);
                return false;
            }
            break;
    }
});

async function sendMessageToGroup(groupId, message) {
    try {
        await client.sendMessage(groupId, message);
        // await client.sendMessage("20120363320566997857@g.us", "message");
    } catch (err) {
        process.send({ message: err.message });
        console.error("Error sending message:", err);
    }
}
