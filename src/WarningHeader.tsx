import React, { useContext } from "react";
import { RuntimeContext } from "./useRuntime";

const WarningHeader: React.FC = () => {
  const { provider } = useContext(RuntimeContext);
  const chainId = provider?.network.chainId;
  if (chainId === 1) {
    return <></>;
  }

  let chainMsg = `ChainID: ${chainId}`;
  if (chainId === 3) {
    chainMsg = "Ropsten Testnet";
  } else if (chainId === 4) {
    chainMsg = "Rinkeby Testnet";
  } else if (chainId === 5) {
    chainMsg = "Görli Testnet";
  } else if (chainId === 42) {
    chainMsg = "Kovan Testnet";
  } else if (chainId === 11155111) {
    chainMsg = "Sepolia Testnet";
  } else if (chainId == 420) {
    chainMsg = "OP Goerli"
  } else if (chainId == 10) {
    chainMsg = "OP Mainnet"
  } else if (chainId == 11155420) {
    chainMsg = "OP Sepolia"
  } else if (chainId == 42051642) {
    chainMsg = "Sunnyside Devnet"
  }
  return (
    <div className="w-full bg-orange-400 text-white text-center font-bold px-2 py-1">
      You are on {chainMsg}
    </div>
  );
};

export default React.memo(WarningHeader);
