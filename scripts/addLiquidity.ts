import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { CSAMM, Token0, Token1 } from "../typechain-types";
import { MINTED_AMOUNT, SWAPPED_AMOUNT } from "../helper-hardhat-config";
import logContractData from "../utils/logContractData";
import { BigNumber } from "ethers";
// ---

async function addLiquidity() {
  const [liquidityProvider] = await ethers.getSigners();
  const networkName: string = network.name;
  const contracts = Object(jsonContracts);
  if (!contracts[networkName].CSAMM) {
    throw new Error("Contract is not deployed yet");
  }
  if (networkName === "hardhat") {
    throw new Error("Can't run scripts to hardhat network deployed contract");
  }
  const csamm: CSAMM = await ethers.getContractAt(
    "CSAMM",
    contracts[networkName].CSAMM,
    liquidityProvider
  );

  const token0: Token0 = await ethers.getContractAt(
    "Token0",
    contracts[networkName].Token0,
    liquidityProvider
  );
  const token1: Token1 = await ethers.getContractAt(
    "Token1",
    contracts[networkName].Token1,
    liquidityProvider
  );

  try {
    // Mint some tokens and make our AMM has access to them

    const mintedAmountPlus10percent: BigNumber = ethers.utils.parseUnits("100");

    await token0.connect(liquidityProvider).mint(MINTED_AMOUNT);
    await token0
      .connect(liquidityProvider)
      .approve(csamm.address, MINTED_AMOUNT);
    await token1.connect(liquidityProvider).mint(mintedAmountPlus10percent);
    await token1
      .connect(liquidityProvider)
      .approve(csamm.address, mintedAmountPlus10percent);

    // Add liquidity
    await csamm
      .connect(liquidityProvider)
      .addLiquidity(MINTED_AMOUNT, mintedAmountPlus10percent);

    await logContractData(liquidityProvider, csamm, token0, token1);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to add liquidity`);
  }

  return csamm;
}

addLiquidity()
  .then((csamm) => {
    console.log(`Liquidity Added Successfully`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
