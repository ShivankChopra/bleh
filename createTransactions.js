const { Sequelize, DataTypes, Transaction } = require('sequelize');

const dbName = 'txntestdb';

const sequelize = new Sequelize({
    dialect: 'mysql',
    database: dbName,
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: 'p@ssw0rd',
    logging: false
});

const Account = sequelize.define('Account', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: DataTypes.STRING,
    balance: DataTypes.BIGINT
}, { tableName: 'accounts', timestamps: true });

const BankTransactions = sequelize.define('Account', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    senderAccountId: { type: DataTypes.INTEGER, references: { model: Account, key: 'id' } },
    recieverAccountId: { type: DataTypes.INTEGER, references: { model: Account, key: 'id' } },
    balance: DataTypes.BIGINT
}, { tableName: 'bank_transactions', timestamps: true });

const ensureTables = async () => {
    await Account.sync();
    await BankTransactions.sync();
};

let john, alice;
const ensureAccounts = async (txn) => {
    john = await Account.findOne({
        transaction: txn,
        lock: txn.LOCK.UPDATE,
        where: {
            'name': 'john'
        }
    });
    alice = await Account.findOne({
        transaction: txn,
        lock: txn.LOCK.UPDATE,
        where: {
            'name': 'alice'
        }
    });
};

const doTransactions = async (noOfTxns) => {
    for (let i = 0; i < noOfTxns; i++) {
        // Randomly deciding the transaction amount
        const randomAmount = Math.floor(Math.random() * 1000) + 1;

        // Determining sender and receiver based on the random amount's even or odd value
        let sender = randomAmount % 2 === 0 ? john : alice;
        let receiver = randomAmount % 2 === 0 ? alice : john;

        // Start a transaction
        const t = await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });

        await ensureAccounts(t);

        try {
            // Ensuring the sender has enough balance to transfer
            if (sender.balance < randomAmount) {
                throw new Error("Insufficient funds");
            }

            // Deducting the amount from the sender's account
            sender.balance -= randomAmount;
            await sender.save({ transaction: t });

            // Adding the amount to the receiver's account
            receiver.balance += randomAmount;
            await receiver.save({ transaction: t });

            // Creating a transaction record
            await BankTransactions.create({
                senderAccountId: sender.id,
                recieverAccountId: receiver.id,
                balance: randomAmount
            }, { transaction: t });

            // Committing the transaction
            await t.commit();
            //console.log(`Transaction successful: ${sender.name} sent ${randomAmount} to ${receiver.name}`);
        } catch (ex) {
            // If an error occurs, rollback any changes
            try {
                await t.rollback();
            } catch (tex) {
                console.log(tex);
            }
            console.log(`Transaction failed: ${ex.message}`);
        }
    }
};

// main
(async () => {
    try {
        await sequelize.authenticate();
        await ensureTables();
        // await ensureAccounts();
        await doTransactions(1000);
    } catch (ex) {
        console.log(ex);
    }
    process.exit();
})();