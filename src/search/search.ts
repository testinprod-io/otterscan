import {
  ChangeEventHandler,
  FormEventHandler,
  RefObject,
  useRef,
  useState,
} from "react";
import { NavigateFunction, useNavigate } from "react-router";
import { JsonRpcProvider, TransactionResponse } from "@ethersproject/providers";
import { isAddress } from "@ethersproject/address";
import { isHexString } from "@ethersproject/bytes";
import useKeyboardShortcut from "use-keyboard-shortcut";
import { PAGE_SIZE } from "../params";
import { ProcessedTransaction, TransactionChunk } from "../types";
import { BigNumber } from "ethers";

export class SearchController {
  private txs: ProcessedTransaction[];

  private pageStart: number;

  private pageEnd: number;

  private constructor(
    readonly address: string,
    txs: ProcessedTransaction[],
    readonly isFirst: boolean,
    readonly isLast: boolean,
    boundToStart: boolean
  ) {
    this.txs = txs;
    if (boundToStart) {
      this.pageStart = 0;
      this.pageEnd = Math.min(txs.length, PAGE_SIZE);
    } else {
      this.pageEnd = txs.length;
      this.pageStart = Math.max(0, txs.length - PAGE_SIZE);
    }
  }

  private static rawToProcessed = (provider: JsonRpcProvider, _rawRes: any) => {
    const _res: TransactionResponse[] = _rawRes.txs.map((t: any) =>
      provider.formatter.transactionResponse(t)
    );

    return {
      txs: _res.map((t, i): ProcessedTransaction => {
        const _rawReceipt = _rawRes.receipts[i];
        const _receipt = provider.formatter.receipt(_rawReceipt);
        var fee: BigNumber;
        var gasPrice: BigNumber;
        if (t.type == 0x7e) {
          // depositTx
          // t.gasPrice is undefined
          fee = BigNumber.from(0);
          gasPrice = BigNumber.from(0);
        } else {
          // pre ecotone - did not use l1Fee and manually calculated using spec
          // fee = gasPrice * gas + l1GasUsed * l1GasPrice * l1FeeScalar
          // const l1GasUsed: BigNumber = provider.formatter.bigNumber(_rawReceipt.l1GasUsed ?? 0);
          // const l1GasPrice: BigNumber = provider.formatter.bigNumber(_rawReceipt.l1GasPrice ?? 0);
          // const l1FeeScalar: number = parseFloat(_rawReceipt.l1FeeScalar ?? 0);
          // const numDecimals: number = Math.floor(l1FeeScalar) == l1FeeScalar ? 0 : l1FeeScalar.toString().split(".")[1].length || 0;
          // // l1feeScalar is float, so scale up and down
          // const l1FeeScalarScaleFactor: BigNumber = BigNumber.from(10).pow(numDecimals)
          // const l1FeeScalarScaled: BigNumber = BigNumber.from(l1FeeScalar * l1FeeScalarScaleFactor.toNumber())
          // legacyTx falls in here
          // when EIP1559, do not have to be recalculated: t.maxPriorityFeePerGas!.add(_block.baseFeePerGas!)
          gasPrice = t.gasPrice!
          // fee = _receipt.gasUsed.mul(gasPrice).add(l1GasUsed.mul(l1GasPrice).mul(l1FeeScalarScaled).div(l1FeeScalarScaleFactor));
          
          // ecotone - directly use l1Fee field
          const l1Fee = provider.formatter.bigNumber(_rawReceipt.l1Fee ?? 0);
          const l2Fee = _receipt.gasUsed.mul(gasPrice);
          fee = l2Fee.add(l1Fee);
        }
        return {
          blockNumber: t.blockNumber!,
          timestamp: provider.formatter.number(_rawReceipt.timestamp),
          idx: _receipt.transactionIndex,
          hash: t.hash,
          from: t.from,
          to: t.to ?? null,
          createdContractAddress: _receipt.contractAddress,
          value: t.value,
          fee: fee,
          gasPrice: gasPrice,
          data: t.data,
          status: _receipt.status!,
        };
      }),
      firstPage: _rawRes.firstPage,
      lastPage: _rawRes.lastPage,
    };
  };

  private static async readBackPage(
    provider: JsonRpcProvider,
    address: string,
    baseBlock: number
  ): Promise<TransactionChunk> {
    const _rawRes = await provider.send("ots_searchTransactionsBefore", [
      address,
      baseBlock,
      PAGE_SIZE,
    ]);
    return this.rawToProcessed(provider, _rawRes);
  }

  private static async readForwardPage(
    provider: JsonRpcProvider,
    address: string,
    baseBlock: number
  ): Promise<TransactionChunk> {
    const _rawRes = await provider.send("ots_searchTransactionsAfter", [
      address,
      baseBlock,
      PAGE_SIZE,
    ]);
    return this.rawToProcessed(provider, _rawRes);
  }

  static async firstPage(
    provider: JsonRpcProvider,
    address: string
  ): Promise<SearchController> {
    const newTxs = await SearchController.readBackPage(provider, address, 0);
    return new SearchController(
      address,
      newTxs.txs,
      newTxs.firstPage,
      newTxs.lastPage,
      true
    );
  }

  static async middlePage(
    provider: JsonRpcProvider,
    address: string,
    hash: string,
    next: boolean
  ): Promise<SearchController> {
    const tx = await provider.getTransaction(hash);
    const newTxs = next
      ? await SearchController.readBackPage(provider, address, tx.blockNumber!)
      : await SearchController.readForwardPage(
          provider,
          address,
          tx.blockNumber!
        );
    return new SearchController(
      address,
      newTxs.txs,
      newTxs.firstPage,
      newTxs.lastPage,
      next
    );
  }

  static async lastPage(
    provider: JsonRpcProvider,
    address: string
  ): Promise<SearchController> {
    const newTxs = await SearchController.readForwardPage(provider, address, 0);
    return new SearchController(
      address,
      newTxs.txs,
      newTxs.firstPage,
      newTxs.lastPage,
      false
    );
  }

  getPage(): ProcessedTransaction[] {
    return this.txs.slice(this.pageStart, this.pageEnd);
  }

  async prevPage(
    provider: JsonRpcProvider,
    hash: string
  ): Promise<SearchController> {
    // Already on this page
    if (this.txs[this.pageEnd - 1].hash === hash) {
      return this;
    }

    if (this.txs[this.pageStart].hash === hash) {
      const overflowPage = this.txs.slice(0, this.pageStart);
      const baseBlock = this.txs[0].blockNumber;
      const prevPage = await SearchController.readForwardPage(
        provider,
        this.address,
        baseBlock
      );
      return new SearchController(
        this.address,
        prevPage.txs.concat(overflowPage),
        prevPage.firstPage,
        prevPage.lastPage,
        false
      );
    }

    return this;
  }

  async nextPage(
    provider: JsonRpcProvider,
    hash: string
  ): Promise<SearchController> {
    // Already on this page
    if (this.txs[this.pageStart].hash === hash) {
      return this;
    }

    if (this.txs[this.pageEnd - 1].hash === hash) {
      const overflowPage = this.txs.slice(this.pageEnd);
      const baseBlock = this.txs[this.txs.length - 1].blockNumber;
      const nextPage = await SearchController.readBackPage(
        provider,
        this.address,
        baseBlock
      );
      return new SearchController(
        this.address,
        overflowPage.concat(nextPage.txs),
        nextPage.firstPage,
        nextPage.lastPage,
        true
      );
    }

    return this;
  }
}

const doSearch = async (q: string, navigate: NavigateFunction) => {
  // Cleanup
  q = q.trim();

  let maybeAddress = q;
  let maybeIndex = "";
  const sepIndex = q.lastIndexOf(":");
  if (sepIndex !== -1) {
    maybeAddress = q.substring(0, sepIndex);
    maybeIndex = q.substring(sepIndex + 1);
  }

  // Plain address?
  if (isAddress(maybeAddress)) {
    navigate(
      `/address/${maybeAddress}${
        maybeIndex !== "" ? `?nonce=${maybeIndex}` : ""
      }`,
      { replace: true }
    );
    return;
  }

  // Tx hash?
  if (isHexString(q, 32)) {
    navigate(`/tx/${q}`, { replace: true });
    return;
  }

  // Block number?
  const blockNumber = parseInt(q);
  if (!isNaN(blockNumber)) {
    navigate(`/block/${blockNumber}`, { replace: true });
    return;
  }

  // Epoch?
  if (q.startsWith("epoch:")) {
    const mayBeEpoch = q.substring(6);
    const epoch = parseInt(mayBeEpoch);
    if (!isNaN(epoch)) {
      navigate(`/epoch/${epoch}`, { replace: true });
      return;
    }
  }

  // Slot?
  if (q.startsWith("slot:")) {
    const mayBeSlot = q.substring(5);
    const slot = parseInt(mayBeSlot);
    if (!isNaN(slot)) {
      navigate(`/slot/${slot}`, { replace: true });
      return;
    }
  }

  // Validator?
  if (q.startsWith("validator:")) {
    const mayBeValidator = q.substring(10);

    // Validator by index
    if (mayBeValidator.match(/^\d+$/)) {
      const validatorIndex = parseInt(mayBeValidator);
      navigate(`/validator/${validatorIndex}`, { replace: true });
      return;
    }

    // Validator by public key
    if (mayBeValidator.length === 98 && isHexString(mayBeValidator, 48)) {
      navigate(`/validator/${mayBeValidator}`, { replace: true });
      return;
    }
  }

  // Assume it is an ENS name
  navigate(
    `/address/${maybeAddress}${
      maybeIndex !== "" ? `?nonce=${maybeIndex}` : ""
    }`,
    { replace: true }
  );
};

export const useGenericSearch = (): [
  RefObject<HTMLInputElement>,
  ChangeEventHandler<HTMLInputElement>,
  FormEventHandler<HTMLFormElement>
] => {
  const [searchString, setSearchString] = useState<string>("");
  const [canSubmit, setCanSubmit] = useState<boolean>(false);
  const navigate = useNavigate();

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const searchTerm = e.target.value.trim();
    setCanSubmit(searchTerm.length > 0);
    setSearchString(searchTerm);
  };

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }

    if (searchRef.current) {
      searchRef.current.value = "";
    }
    doSearch(searchString, navigate);
  };

  const searchRef = useRef<HTMLInputElement>(null);
  useKeyboardShortcut(["/"], () => {
    searchRef.current?.focus();
  });

  return [searchRef, handleChange, handleSubmit];
};
