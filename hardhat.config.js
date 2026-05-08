require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",

  networks: {
    arc: {
      url: process.env.ARC_RPC_URL,
      chainId: 5042002,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};