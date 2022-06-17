const ethers = require("ethers");
const readline = require("readline")
let { addresses } = require("./watch_address.json");

function sleep(milliseconds) { const date = Date.now(); let currentDate = null; do { currentDate = Date.now(); } while (currentDate - date < milliseconds); }


let filter = {
    topics: [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        "0x0000000000000000000000000000000000000000000000000000000000000000"
    ]
};

let abi = [
    {
        "inputs": [],
        "name": "totalSupply",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "getApproved",
        "outputs": [
            {
                "internalType": "address",
                "name": "",
                "type": "address"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    { "inputs": [], "name": "maxSupply", "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }], "stateMutability": "view", "type": "function" }
];



(async () => {
    private_key = await askQuestion("请输入私钥：")
    gasLimit = await askQuestion("请输入gas: ");
    targetValue = await askQuestion("请输入价格: ");

    provider = new ethers.providers.WebSocketProvider("wss://eth-mainnet.alchemyapi.io/v2/uQI5scqee6ZVvf2XK3UmBsbA36iF-50V");
    wallet = new ethers.Wallet(private_key, provider);
    minted = [];
    nonces = [];
    loged = [];
    console.log("开始监控")

    addresses = addresses.map((v, i) => {
        return "0x000000000000000000000000" + v.toLocaleLowerCase().slice(2);
    })

    filter.topics.push(addresses);
    console.log(addresses);

    ret = await listen();
    while (!ret) {
        sleep(5000);
        ret = await listen();
    }

    function listen() {
        return new Promise((resolve, reject) => {
            try {
                provider.on(filter, async (log) => {
                    let transactionHash = log.transactionHash;
                    if (!loged.includes(transactionHash)) {
                        // console.log(log);
                        loged.push(transactionHash);
                        let transaction = await provider.getTransaction(transactionHash).catch((err) => {
                            reject(err);
                        });
                        if (transaction != null) {
                            let from = transaction.from;
                            let to = transaction.to;
                            let data = transaction.data;
                            let value = transaction.value / 1;
                            let gasLimit = transaction.gasLimit / 1;
                            let gasPrice = transaction.gasPrice / 10 ** 18;
                            let totalValue = (gasLimit * gasPrice) * 10 ** 18;
                            let txHash = transaction.hash;
                            let nonce = transaction.nonce;
                            if (
                                totalValue + value <= targetValue * 10 ** 18 &&
                                !data.includes(from.slice(2).toLocaleLowerCase()) &&
                                !minted.includes(txHash) &&
                                !nonces.includes(nonce)
                            ) {
                                if (await isERC721(log.address) &&
                                    !await isMintAll(log.address)
                                ) {

                                    console.log("检测到一条mint交易，交易hash：", transactionHash);
                                    minted.push(txHash);
                                    try {
                                        await wallet.sendTransaction({
                                            to: to,
                                            gasLimit: gasLimit,
                                            data: data,
                                            value: value.toString()
                                        }).then((tx) => {
                                            console.log("mint成功, 交易hash:", !tx.transactionHash ? tx.hash : tx.transactionHash);
                                            nonces.push(!tx.transactionHash ? tx.nonce : tx.transaction.nonce);
                                        }).catch((err) => {
                                            if (err.toString().includes("insufficient funds for gas * price + value")) {
                                                console.error("余额不足");
                                            } else {
                                                reject(err);
                                            }
                                        })

                                    } catch (error) {
                                        reject(error);
                                    }
                                }

                            }
                        }
                    }
                });
            } catch (error) {
                if (error.toString().includes("Your app has exceeded its compute units per second capacity")) {
                    reject(error);
                }
            }
        })


    }



    async function isERC721(address) {
        try {
            let token = new ethers.Contract(address, abi, provider);
            await token.getApproved(1);
            return true;
        } catch (error) {
            // console.log(error)
            if (error.toString().includes("approved query for nonexistent toke")) {
                return true;
            }
            return false;
        }

    }

    async function isMintAll(address) {
        try {
            let token = new ethers.Contract(address, abi, provider);
            let totalSupply = await token.totalSupply();
            let maxSupply = await token.maxSupply();
            if (totalSupply.toString() == maxSupply.toString()) {
                return true;
            }

        } catch (error) {
            return false;
        }
    }
})()



function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}