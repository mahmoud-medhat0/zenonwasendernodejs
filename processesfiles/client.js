const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const SessionModel = require("../models/SessionModel");
const WaSendedMessages = require("../models/WaSendedMessages");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
let client;
const sessionId = process.argv[2];

function initializeClient() {
    client = new Client({
        puppeteer: {
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--disable-setuid-sandbox",
                "--no-first-run",
                "--no-zygote",
                "--single-process",
                "--force-device-scale-factor=2",
            ],
        },
        authStrategy: new LocalAuth({ clientId: sessionId }),
    });

    client.on("ready", async () => {
        const sessionModel = new SessionModel();
        sessionModel.updateBySessionId(sessionId, "status", "readyforsendmessage");
        process.send({
            sessionId,
            type: "ready",
            message: `Client is ready for session ${sessionId}`,
        });
        // client.sendMessage('120363318507018014@g.us', 'test ready')
    });

    client.on("auth_failure", (msg) => {
        const sessionModel = new SessionModel();
        sessionModel.updateBySessionId(sessionId, "status", "auth_failure");
        process.send({
            sessionId,
            type: "auth_failure",
            message: `Authentication failure: ${msg}`,
        });
    });

    client.on("disconnected", async (reason) => {
        const sessionModel = new SessionModel();
        sessionModel.updateBySessionId(sessionId, "status", "disconnected");
        sessionModel.updateBySessionId(sessionId, "phone_number", "");
        sessionModel.updateBySessionId(sessionId, "qrcode", "");
        process.send({
            sessionId,
            type: "disconnected",
            message: `Client disconnected: ${reason}`,
        });
        process.exit(); // Terminate the child process when disconnected
        await removeAuthFiles(authDirectory, sessionId);
    });

    client.on("message_sent", async (message) => {
        // await commandMessage(message);
        // process.send({ sessionId, type: 'message_sent', message: `Message sent: ${message}` });
    });

    client.on("message", async (message) => {
        // console.log("message", message.fromMe);
        await commandMessage(message);
    });
    client.on("message_create", async (message) => {
        // console.log("message_create", message);
        if (message.fromMe) {
            await commandMessage(message);
        }
    });
    client.on("qr", async (qrReceived, asciiQR) => {
        try {
            const qrCodeDataUrl = await qrcode.toDataURL(qrReceived);
            const sessionModel = new SessionModel();
            sessionModel.updateBySessionId(sessionId, "qrcode", qrCodeDataUrl);
            console.log(`New QR RECEIVED for session ${sessionId}`);
        } catch (error) {
            console.log("Error updating QRCODE", error);
        }
    });

    client.on("error", async (error) => {
        console.log("Error", error);
        if (error.message.includes("Execution context was destroyed")) {
            console.log("Reinitializing client due to execution context destruction");
            await retryDestroyAndInitializeClient();
        } else {
            await client
                .destroy()
                .catch((err) => console.log("Error destroying client", err));
        }
    });

    client.initialize();
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
    if (isActiveSubcription) {
        if (message.id.remote.includes("@g.us")) {
            if (message.body.includes("معلومات")) {
                console.log("message", message);
                client
                    .sendMessage("201148422820@c.us", "معلومات : " + message.id.remote)
                    .then(() =>
                        process.send({
                            sessionId,
                            type: "message_sent",
                            message: `Replied to ${message.from} with: ${message.body}`,
                        })
                    )
                    .catch((err) =>
                        process.send({
                            sessionId,
                            type: "error",
                            message: `Error replying to message: ${err.message}`,
                        })
                    );
            } else if (message.body.includes("ابديت")) {
                const updateValue = message.body.split("ابديت")[1].trim();
                const sessionModel = new SessionModel();
                const userData = await sessionModel.getUserBySessionId(sessionId);
                orginalGroupId = message.id.remote.replace("@g.us", "");
                if (userData.endpoint_api) {
                    axios
                        .post(userData.endpoint_api + "search-orders-data-by-group-id", {
                            group_id: orginalGroupId,
                            search: updateValue,
                        })
                        .then((response) => {
                            const orders = response.data.orders;
                            let messageData = "";
                            if (Array.isArray(orders)) {
                                if (orders.length == 0) {
                                    messageData = "لا يوجد طلبات بهذة البيانات";
                                } else {
                                    // console.log("orders", orders);
                                    messageData =
                                        "قائمة الطلبات : " + response.data.count + " طلب \n";
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
                            message
                                .reply(messageData)
                                .then(() =>
                                    process.send({
                                        sessionId,
                                        type: "message_sent",
                                        message: `Replied to ${message.from} with: ${message.body}`,
                                    })
                                )
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
                                .sendMessage(message.from, "حدث خطأ ما في الرد علي المعلومات")
                                .catch((err) => console.error("Error sending message:", err));
                        });
                } else {
                    client
                        .sendMessage(message.from, "لا يوجد ايدي المستخدم في البوت")
                        .catch((err) => console.error("Error sending message:", err));
                }
            }
        }
    }
}
initializeClient();

process.on("message", async (message) => {
    const { type, payload } = message;
    // console.log(`Received message from parent:`, message);
    switch (type) {
        case "send_message":
            const { to, body } = payload;
            console.log(`Sending message to ${to}: ${body}`);
            client
                .sendMessage(to, body)
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
            return client
                .getNumberId(phoneNumber)
                .then(async (result) => {
                    process.send({
                        sessionId,
                        type: "number_id",
                        message: `Number ID: ${result}`,
                    });
                    process.send({ result });
                    return result == null ? false : true;
                })
                .catch((err) =>
                    process.send({
                        sessionId,
                        type: "error",
                        message: `Error getting number ID: ${err.message}`,
                    })
                );
            break;
        case "check_I_in_group":
            var groupId = message.payload;
            const chats = await client.getChats();
            var group = chats.find(
                (chat) => chat.isGroup && chat.id._serialized === groupId
            );
            const result = group ? true : false;
            if (result) {
                process.send({ SendMessageToGroup: groupId });
                console.log(`Client is part of the group: ${groupId}`);
                // await sendMessageToGroup("20120363320566997857@g.us", "message");
                // await sendMessageToGroup(group.id._serialized, "معلومات : " + groupId);
            } else {
                console.log("Client is not part of the group:", groupId);
                return false;
            }
            return result;
            break;
        case "send_message_to_group":
            var {groupId,message} = message.payload;
            console.log("groupId", groupId);
            try {
                const result = await client.sendMessage(groupId, message);
                console.log("Message sent to group:", result);
                return result;
                return true;
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
