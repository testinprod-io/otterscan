import React, { useContext } from "react";
import { BigNumber } from "@ethersproject/bignumber";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBurn, faCoins } from "@fortawesome/free-solid-svg-icons";
import FormattedBalance from "../components/FormattedBalance";
import PercentageGauge from "../components/PercentageGauge";
import { RuntimeContext } from "../useRuntime";
import { useBlockDataFromTransaction } from "../useErigonHooks";
import { useChainInfo } from "../useChainInfo";
import { TransactionData } from "../types";
import { faEthereum } from "@fortawesome/free-brands-svg-icons";

type RewardSplitProps = {
  txData: TransactionData;
};

const RewardSplit: React.FC<RewardSplitProps> = ({ txData }) => {
  const { provider } = useContext(RuntimeContext);
  const block = useBlockDataFromTransaction(provider, txData);

  const {
    nativeCurrency: { symbol },
  } = useChainInfo();
  // for depositTx, totalFees == 0 so ignore
  // totalFees = paidFees + l1Fees
  // paidFees = burntFees + minerReward
  const totalFees = txData.confirmedData!.fee
  // when paidFees == 0, set burntFees == 0
  const paidFees = txData.gasPrice.mul(txData.confirmedData!.gasUsed);
  const l1Fees = totalFees.sub(paidFees);
  const burntFees = paidFees.isZero() ? BigNumber.from(0) : (
      block
      ? block.baseFeePerGas!.mul(txData.confirmedData!.gasUsed)
      : BigNumber.from(0)
  );
  const minerReward = paidFees.sub(burntFees);
  // percent may not add up to full 100% 
  const burntPerc = totalFees.isZero() ? 0 : Math.round(burntFees.mul(10000).div(totalFees).toNumber()) / 100;
  const l1Perc = totalFees.isZero() ? 0 : Math.round(l1Fees.mul(10000).div(totalFees).toNumber()) / 100;
  const minerPerc = totalFees.isZero() ? 0 : Math.round(minerReward.mul(10000).div(totalFees).toNumber()) / 100;

  return (
    <div className="inline-block">
      <div className="grid grid-cols-2 gap-x-2 gap-y-1 items-center text-sm">
        <PercentageGauge
          perc={burntPerc}
          bgColor="bg-orange-100"
          bgColorPerc="bg-orange-500"
          textColor="text-orange-800"
        />
        <div className="flex items-baseline space-x-1">
          <span className="flex space-x-1 text-orange-500">
            <span title="Burnt fees">
              <FontAwesomeIcon icon={faBurn} size="1x" />
            </span>
            <span>
              <span className="line-through">
                <FormattedBalance value={burntFees} />
              </span>{" "}
              {symbol}
            </span>
          </span>
        </div>
        <PercentageGauge
          perc={minerPerc}
          bgColor="bg-amber-100"
          bgColorPerc="bg-amber-300"
          textColor="text-amber-700"
        />
        <div className="flex items-baseline space-x-1">
          <span className="flex space-x-1">
            <span className="text-amber-300" title="Miner fees">
              <FontAwesomeIcon icon={faCoins} size="1x" />
            </span>
            <span>
              <FormattedBalance value={minerReward} /> {symbol}
            </span>
          </span>
        </div>
        <PercentageGauge
          perc={l1Perc}
          bgColor="bg-blue-100"
          bgColorPerc="bg-blue-300"
          textColor="text-blue-700"
        />
        <div className="flex items-baseline space-x-1">
          <span className="flex space-x-1">
            <span className="text-blue-300" title="L1 Security fees">
              <FontAwesomeIcon icon={faEthereum} size="1x" />
            </span>
            <span>
              <FormattedBalance value={l1Fees} /> {symbol}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(RewardSplit);
