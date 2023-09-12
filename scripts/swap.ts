import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { CSAMM, Token0, Token1 } from "../typechain-types";
import { MINTED_AMOUNT, SWAPPED_AMOUNT } from "../helper-hardhat-config";
import logContractData from "../utils/logContractData";
import { BigNumber } from "ethers";
// ---

async function swap() {
  const [liquidityProvider, swapper] = await ethers.getSigners();
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
    await token0.connect(swapper).mint(SWAPPED_AMOUNT);
    await token0.connect(swapper).approve(csamm.address, SWAPPED_AMOUNT);

    // Swap token0 and take token1
    await csamm.connect(swapper).swap(token0.address, SWAPPED_AMOUNT);
    await logContractData(swapper, csamm, token0, token1);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to swap`);
  }

  return csamm;
}

swap()
  .then((csamm) => {
    console.log(`Swapped Successfully`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
