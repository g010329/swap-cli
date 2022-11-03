#!/usr/bin/env node

const { program } = require("commander");
const fetch = require("node-fetch");
// const { ethers } = require("ethers");
const { ethers } = require("hardhat");
const genericErc20Abi = require("./ABI.json");
const WETH9 = require("./WETH9.json");

// user input: fromToken, toToken, amount
// const fromToken = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const chain = 1; // 1 ,137
const fromToken = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const toToken = "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0";
const amount = 10;
const walletAddress = "";
const slippage = 5;

const provider = new ethers.providers.InfuraProvider(
  "mainnet", // "goerli"
  process.env.INFURA_KEY
);
// polygon mainnet
// const provider = new ethers.providers.JsonRpcProvider(
//   process.env.QUICKNODE_PROVIDER
// );

// const signer = provider.getSigner();

// 1. Get token list
const fetchTokenList = async () => {
  return await fetch(`https://api.1inch.io/v4.0/${chain}/tokens`).then((d) =>
    d.json()
  );
};

// 2. Check if Wrap/Unwrap
const checkIfWrapOrUnwrap = (fromToken, toToken) => {
  // TODO: 改用地址?
  if (
    (fromToken === "ETH" && toToken === "WETH") ||
    (fromToken === "WETH" && toToken === "ETH")
  ) {
    // 判斷是否為 wrap or unwrap 操作，如果是走另一個流程
    return true;
  }
  return false;
};

// Handle unit conversion using token list data
const parseAmount = (fromToken, amount) => {
  const fromTokenDecimal = tokenList?.tokens?.[fromToken]?.decimals;
  // TODO: check overflow?
  const parsedAmount = (amount * 10) ^ fromTokenDecimal;
  // console.log(fromTokenDecimal);
  console.log(amount * 10 ** fromTokenDecimal);
  return parsedAmount;
};

// 3. Provide Quote
const getQuote = async () => {
  const res = await fetch(
    `https://api.1inch.io/v4.0/${chain}/quote?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}`
  );
  const swapPriceJSON = await res.json();
  console.log("Price: ", swapPriceJSON);
};

// 4. Check allowance: 要看的是我們自己的合約允許使用多少 user 的 token
const checkAllowance = async () => {
  // TODO: call contract allowance function
  // return fetch(
  //   `https://api.1inch.io/v4.0/${chain}/approve/allowance?tokenAddress=${fromToken}&walletAddress=${walletAddress}`
  // )
  //   .then((res) => res.json())
  //   .then(
  //     (res) => console.log("res", res)
  //     // return res.allowance
  //     // res: {allowance: "0"} 代表可調用的數量為0
  //   );

  const [signer] = await ethers.getSigners();

  const Erc20Factory = await ethers.getContractFactory("TestToken");
  const erc20 = await Erc20Factory.deploy(10000);
  await erc20.deployed();
  // const tokenContractAddress = erc20.address; //137 matic: 0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0
  // const tokenContract = new ethers.Contract(
  //   tokenContractAddress,
  //   genericErc20Abi,
  //   provider
  // );

  const SwapRouterFactory = await ethers.getContractFactory("KGRouter");
  const swapRouter = await SwapRouterFactory.deploy();
  await swapRouter.deployed();

  const allowance = (
    await erc20.allowance(signer.address, swapRouter.address)
  ).toString();

  console.log("allowance", allowance);
};

// 5. Approve token if allowance is not enough
const approveAllowance = async () => {
  let wallet = new ethers.Wallet(process.env.PRIVATE_KEY);

  // let provider = ethers.getDefaultProvider();
  let walletWithProvider = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  // const Erc20Factory = await ethers.getContractFactory("TestToken");
  // const erc20 = await Erc20Factory.deploy(10000);
  // await erc20.deployed();
  // goerli uni token address:0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984
  const tokenContractAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984"; //137 matic 0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0
  const tokenContract = new ethers.Contract(
    tokenContractAddress,
    genericErc20Abi,
    // provider
    walletWithProvider
  );

  const SwapRouterFactory = await ethers.getContractFactory("KGRouter");
  const swapRouter = await SwapRouterFactory.deploy();
  await swapRouter.deployed();

  let allowance = // await erc20.allowance(signer.address, swapRouter.address)
    (
      await tokenContract.allowance(
        walletWithProvider.address,
        swapRouter.address
      )
    ).toString();

  console.log("allowance before approve ", allowance);

  const res = await tokenContract.approve(swapRouter.address, 10);
  console.log("res", res);
};

// 6. Send swap transaction
const Swap = async () => {
  const res = await fetch(
    `https://api.1inch.io/v4.0/1/swap?fromTokenAddress=${fromToken}&toTokenAddress=${toToken}&amount=${amount}&fromAddress=${walletAddress}&slippage=${slippage}`
  )
    .then((res) => res.json())
    .then((d) => d.tx);

  console.log("Swap tx data: ", res);

  // const SwapRouterFactory = await ethers.getContractFactory("KGRouter");
  // const swapRouter = await SwapRouterFactory.deploy();
  // await swapRouter.deployed();

  // fillQuoteEthToToken
  let ABI = [
    "function fillQuoteEthToToken(address buyTokenAddress,address payable target,bytes calldata swapCallData,uint256 feeAmount)",
  ];
  let interface = new ethers.utils.Interface(ABI);
  const result = await interface.encodeFunctionData("fillQuoteEthToToken", [
    fromToken,
    toToken,
    res.data,
    parseInt(res.value) * 0.05, // * 10000 => underflow
  ]);

  console.log("result", result);

  const txCount = await provider.getTransactionCount(walletAddress);
  // await wallet.getTransactionCount()
  // // console.log("txCount", txCount, ethers.utils.hexlify(txCount));
  const tx = {
    // nonce: ethers.utils.hexlify(txCount),
    nonce: txCount, //TODO:
    gasPrice: 20000000000,
    gasLimit: 1000000,
    to: "KG router合約地址",
    value: ethers.utils.parseEther("0"),
    data: result,
    chainId: 137,
  };

  // const signedTxResponse = await wallet.signTransaction(tx);
  const [signer] = await ethers.getSigners();
  const sendTxResponse = await signer.sendTransaction(tx);
  await sentTxResponse.wait(1);
  console.log(sentTxResponse);

  // // fillQuoteTokenToToken
  // let ABI = [
  //   "function fillQuoteTokenToToken(address sellTokenAddress, address buyTokenAddress, address payable target, bytes calldata swapCallData, uint256 sellAmount, uint256 feeAmount)",
  // ];
  // let interface = new ethers.utils.Interface(ABI);
  // const result = await interface.encodeFunctionData("fillQuoteTokenToToken", [
  //   fromToken,
  //   toToken,
  //   res.to,
  //   res.data,
  //   res.value,
  //   parseInt(res.value) * 0.05,
  // ]);
};

// 6-1. Wrap/Unwrap
const WrapAndUnwrap = async () => {
  [signer, signer2] = await ethers.getSigners();

  Weth = new ethers.ContractFactory(WETH9.abi, WETH9.bytecode, signer);
  weth = await Weth.deploy();

  const wethTime0 = await weth.balanceOf(signer2.address);
  console.log("wethTime0", wethTime0.toNumber());

  await signer2.sendTransaction({
    to: weth.address,
    value: ethers.utils.parseEther("0.004"),
  });

  const wethTime1 = await weth.balanceOf(signer2.address);
  console.log("wethTime1", wethTime1);

  // // Unwrap--------------------------------------------------
  await weth
    .connect(signer2)
    .approve(weth.address, ethers.utils.parseEther("0.004"));

  await weth.connect(signer2).withdraw(ethers.utils.parseEther("0.002"), {
    gasLimit: 5000000,
  });

  const wethTime2 = await weth.balanceOf(signer2.address);
  console.log("wethTime2", wethTime2); //0.002
};

// parseAmount("0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", 1);
// getQuote();
// checkAllowance();
// approveAllowance();
// Swap();
// Wrap();
