const { fork } = require('child_process');
const { Sequelize, DataTypes, Transaction } = require('sequelize');

const dbName = 'txntestdb';

const sequelize = new Sequelize({
    dialect: 'mysql',
    database: dbName,
    host: '127.0.0.1',
    port: 3306,
    username: 'root',
    password: 'p@ssw0rd'
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
    await BankTransactions.drop();
    await Account.drop();

    await Account.sync();
    await BankTransactions.sync();
};

let john, alice;
const ensureAccounts = async () => {
    john = await Account.create({
        name: 'John',
        balance: 1000000
    });

    alice = await Account.create({
        name: 'Alice',
        balance: 2000000
    });
};

const verifyBalances = async () => {
    console.log('Total balance at the end : ' + (john.balance + alice.balance));
};

// main
(async () => {
    await sequelize.authenticate();
    await ensureTables();
    await ensureAccounts();

    const pathToScript = './createTransactions.js'; // Path to the script file
    const numInstances = 30; // Number of instances to run
    const childProcesses = [];

    for (let i = 0; i < numInstances; i++) {
        const child = fork(pathToScript);

        child.on('error', (err) => {
            console.error(`Child process ${child.pid} encountered an error: ${err}`);
        });

        child.on('exit', (code) => {
            console.log(`Child process ${child.pid} exited with code ${code}`);
            // Remove the process from the array when it exits
            const index = childProcesses.indexOf(child);
            if (index > -1) {
                childProcesses.splice(index, 1);
            }
            // Check if all child processes have exited
            if (childProcesses.length === 0) {
                console.log('All child processes have completed.');
                verifyBalances();
                process.exit(); // Exit the main process when all children are done
            }
        });

        childProcesses.push(child); // Store the child process in the array
    }

    console.log('All child processes have been started.');
})();