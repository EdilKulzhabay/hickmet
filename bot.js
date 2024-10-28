const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const mongoose = require("mongoose")
const User = require("./User")

mongoose
    .connect("mongodb://localhost:27017/hicmet")
    .then(() => {
        console.log("Mongodb OK");
    })
    .catch((err) => {
        console.log("Mongodb Error", err);
    });

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        timeout: 60000,
        args: ['--no-sandbox', '--disable-setuid-sandbox'], // Добавляем флаги
    },
});

client.on("qr", (qr) => {
    console.log("QR-код получен. Сканируйте для авторизации.");
    qrcode.generate(qr, { small: true });
});

client.on("authenticated", (session) => {
    console.log(
        "Authenticated with session:",
        session ? JSON.stringify(session) : "undefined"
    );
});

client.on("auth_failure", (msg) => {
    console.error("Authentication failed:", msg);
});

client.on("disconnected", (reason) => {
    console.log("Client was logged out:", reason);
});

client.on("ready", () => {
    console.log("Client is ready!");
});

let uniqueUsersToday = new Set(); // Хранит уникальные ID пользователей за сегодня
let lastCheckDate = new Date().toLocaleDateString(); // Последняя дата для сброса
let userStates = {};

function resetCountersIfNeeded() {
    const currentDate = new Date().toLocaleDateString();
    if (lastCheckDate !== currentDate) {
        // Если наступил новый день, сбрасываем счетчики
        uniqueUsersToday.clear();
        messagesToTelegramToday = 0;
        lastCheckDate = currentDate;
    }
}

const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) {
        return "0 тенге"; // Или любое другое значение по умолчанию
    }

    // Преобразуем число в строку и форматируем его
    return `${String(amount).replace(/\B(?=(\d{3})+(?!\d))/g, " ")}`;
};

const welcomeMessage = "Здравствуйте! 👋\nЯ виртуальный помощник по проекту Jenil Jina от компании Hickmet.\nОтправьте свой ИИН для проверки Баланса"
const notIIN = "Прошу прощения, вашего ИИН нет в базе данных.\nПроверьте, правильно ли вы ввели ИИН"
const notIIN2 = "Если 'Нет', отправьте ИИН снова 😊.\nЕсли 'Да', обратитесь к менеджеру по ссылке ниже 👇:\nwa.me/77003152211"
const addIIN = "Отправьте ИИН, который хотите добавить Базу Данных 📁"
const addIINBalance = "Отправьте баланс данного пользователя для его добавления 💵"
const addIINRes = (iin, balance) => {
    return `В базу данных был добавлен пользователь❗\nИИН: ${iin} 🆔\nБаланс: ${formatCurrency(balance)} 💸`
}
const changeIIN = "Введите ИИН пользователя чей баланс хотите отредактировать✏️"
const changeIINBalance = "Введите баланс данного пользователя для его редактироавния ✏️"
const changeIINRes = (iin, balance) => {
    return `Балнас пользователя был изменен❗\nИИН: ${iin} 🆔\nБаланс: ${formatCurrency(balance)} 💸`
}
const delIIN = "Введите ИИН пользователя которого хотите удалить 🗑️"
const delIINRes = (iin, balance) => {
    return `Пользователь успешно удален🚫\nИИН: ${iin}\nБаланс: ${formatCurrency(balance)} 💸`
}


client.on("message", async (msg) => {
    const chatId = msg.from;
    const messageText = msg.body.trim();

    resetCountersIfNeeded();

    const isNewUser = !uniqueUsersToday.has(chatId);
    uniqueUsersToday.add(chatId);

    if (isNewUser) {
        client.sendMessage(chatId, welcomeMessage);
        return;
    }

    if (!userStates[chatId]) {
        userStates[chatId] = { type: null, step: null, iin: null, balance: null };
    }

    if (messageText.startsWith("/add_balance")) {
        userStates[chatId] = { type: "add", step: "awaitingIIN", iin: null, balance: null };
        client.sendMessage(chatId, addIIN);
        return;
    }

    if (messageText.startsWith("/change")) {
        userStates[chatId] = { type: "change", step: "awaitingIIN", iin: null, balance: null };
        client.sendMessage(chatId, changeIIN);
        return;
    }

    if (messageText.startsWith("/delete")) {
        userStates[chatId] = { type: "delete", step: "awaitingIIN", iin: null, balance: null };
        client.sendMessage(chatId, delIIN);
        return;
    }

    if (userStates[chatId].step === "awaitingIIN") {
        if (/^\d{12}$/.test(messageText)) {
            if (userStates[chatId].type === "add") {
                const user = await User.findOne({iin: messageText})
                if (user) {
                    client.sendMessage(chatId, "В базе данных такой ИИН уже существует!");
                    userStates[chatId] = { type: null, step: null, iin: null, balance: null }; // Сброс состояния
                    return;
                } else {
                    client.sendMessage(chatId, addIINBalance)
                    userStates[chatId].iin = messageText;
                    userStates[chatId].step = "awaitingBalance";
                    return;
                }
            }
            if (userStates[chatId].type === "change") {
                const user = await User.findOne({iin: messageText})
                if (!user) {
                    client.sendMessage(chatId, `Пользователь с ИИН ${messageText} не найден в базе данных.`);
                    userStates[chatId] = { type: null, step: null, iin: null, balance: null }; // Сброс состояния
                    return;
                } else {
                    client.sendMessage(chatId, changeIINBalance)
                    userStates[chatId].iin = messageText;
                    userStates[chatId].step = "awaitingBalance";
                    return;
                }
            }
            if (userStates[chatId].type === "delete") {
                const user = await User.findOne({iin: messageText})
                if (!user) {
                    client.sendMessage(chatId, `Пользователь с ИИН ${messageText} не найден в базе данных.`);
                    userStates[chatId] = { type: null, step: null, iin: null, balance: null }; // Сброс состояния
                    return
                } else {
                    await User.deleteOne({ iin: messageText });
                    client.sendMessage(chatId, delIINRes(user.iin, user.balance));
                    userStates[chatId] = { type: null, step: null, iin: null, balance: null }; // Сброс состояния
                    return
                }
            }
        } else {
            client.sendMessage(chatId, "Неверный формат ИИН. Пожалуйста, отправьте 12-значный ИИН.");
        }
        return;
    }

    if (userStates[chatId].step === "awaitingBalance") {
        if (/^\d+$/.test(messageText)) {
            userStates[chatId].balance = Number(messageText);
            const { type, iin, balance } = userStates[chatId];

            if (type === "add") {
                const newUser = new User({
                    iin,
                    balance
                })
                await newUser.save()
                client.sendMessage(chatId, addIINRes(iin, balance));
            } else {
                const user = await User.findOne({ iin });

                if (!user) {
                    client.sendMessage(chatId, `Пользователя с таким ИИН-ом нет ${iin}`);
                } else {
                    user.balance = balance
                    await user.save();
                    client.sendMessage(chatId, changeIINRes(iin, balance));
                }
            }

            userStates[chatId] = { type: null, step: null, iin: null, balance: null }; // Сброс состояния
        } else {
            client.sendMessage(chatId, "Неверный формат баланса. Пожалуйста, отправьте числовое значение.");
        }
        return;
    }

    if (messageText) {
        // 1. Проверка на сообщение, состоящее только из 12 цифр (ИИН)
        if (/^\d{12}$/.test(messageText)) {
            const user = await User.findOne({iin: messageText})
            if (!user) {
                client.sendMessage(chatId, notIIN);
                client.sendMessage(chatId, notIIN2);
                return;
            }
            client.sendMessage(chatId, `Текущии баланс в вашей копилке составляет: ${user.balance}тг 💸`);
            return;
        }

        if (/^\d+$/.test(messageText) && messageText.length !== 12) {
            client.sendMessage(chatId, notIIN);
            client.sendMessage(chatId, notIIN2);
            return;
        }

        client.sendMessage(chatId, "Прошу введите свои ИИН для проверки своего баланса 💵")
    }
});

client.initialize();
