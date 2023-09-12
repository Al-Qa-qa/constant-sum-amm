import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { CSAMM, Token0, Token1 } from "../typechain-types";
import { MINTED_AMOUNT, SWAPPED_AMOUNT } from "../helper-hardhat-config";
import logContractData from "../utils/logContractData";
import { BigNumber } from "ethers";
// ---

async function removeLiquidity() {
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
    // Remove liquidity

    await logContractData(liquidityProvider, csamm, token0, token1);

    const shares: BigNumber = MINTED_AMOUNT.add(MINTED_AMOUNT);

    await csamm.connect(liquidityProvider).removeLiquidity(shares);

    await logContractData(liquidityProvider, csamm, token0, token1);
  } catch (err) {
    console.log(err);
    console.log("----------------------");
    throw new Error(`Failed to remove liquidity`);
  }

  return csamm;
}

removeLiquidity()
  .then((csamm) => {
    console.log(`Liquidity Removed Successfully`);
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
