const XLSX = require("xlsx")
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

const processExcelFile = async (filePath) => {
    try {
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

        for (const row of worksheet) {
            try {
                const iin = row.iin?.toString();
                const user = await User.findOne(iin)
                if (user) {
                    continue;
                }
                if (!iin || iin.length !== 12) {
                    continue;
                }
                const balance = Number(row.balance) || 0;

                await User.create({ iin, balance });
            } catch (err) {
                console.error("Error creating user:", err.message);
            }
        }
    } catch (err) {
        console.error('Error reading the Excel file:', err.message);
        throw new Error('Failed to process Excel file');
    }
};

const addUsersData = async () => {
    try {
        const filePath = "./data.xlsx";
        await processExcelFile(filePath);
        console.log("File processed successfully");
    } catch (error) {
        console.log("Error:", error.message);
    }
}

addUsersData();
