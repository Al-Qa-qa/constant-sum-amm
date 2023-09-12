import { network, ethers } from "hardhat";
import { CSAMM, Token0, Token1 } from "../typechain-types";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

async function logContractData(
  caller: SignerWithAddress,
  csamm: CSAMM,
  token0: Token0,
  token1: Token1
) {
  const csammToken0Balance: BigNumber = await token0.balanceOf(csamm.address);
  const csammToken1Balance: BigNumber = await token1.balanceOf(csamm.address);

  const callerToken0Balance: BigNumber = await token0.balanceOf(caller.address);
  const callerToken1Balance: BigNumber = await token1.balanceOf(caller.address);

  const shares: BigNumber = await csamm.balanceOf(caller.address);
  const reserve0: BigNumber = await csamm.getReserve0();
  const reserve1: BigNumber = await csamm.getReserve1();
  const totalSupply: BigNumber = await csamm.getTotalSupply();

  console.log("------------------------------");
  console.log(
    "CSAMM token0 balance:",
    ethers.utils.formatUnits(csammToken0Balance)
  );
  console.log(
    "CSAMM token1 balance:",
    ethers.utils.formatUnits(csammToken1Balance)
  );
  console.log(
    "Caller token0 balance:",
    ethers.utils.formatUnits(callerToken0Balance)
  );
  console.log(
    "Caller token1 balance:",
    ethers.utils.formatUnits(callerToken1Balance)
  );
  console.log("Caller Shares:", ethers.utils.formatUnits(shares));
  console.log("reserve0:", ethers.utils.formatUnits(reserve0));
  console.log("reserve1:", ethers.utils.formatUnits(reserve1));
  console.log("totalSupply", ethers.utils.formatUnits(totalSupply));
  console.log("------------------------------");
}

export default logContractData;
