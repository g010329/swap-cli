require("@nomicfoundation/hardhat-toolbox");
require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.11",
  networks: {
    goerli: {
      url: process.env.INFURA_PROVIDER,
      accounts: [process.env.PRIVATE_KEY],
    },
    hardhat: {
      forking: {
        url: process.env.ALCHEMY_PROVIDER,
        blockNumber: 15759400,
        enabled: true,
      },
      allowUnlimitedContractSize: true,
    },
  },
};
