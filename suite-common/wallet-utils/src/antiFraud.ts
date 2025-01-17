import BigNumber from 'bignumber.js';
import { D } from '@mobily/ts-belt';

import type { TokenDefinitions, WalletAccountTransaction } from '@suite-common/wallet-types';

import { isNftTokenTransfer } from './transactionUtils';

export const getIsZeroValuePhishing = (transaction: WalletAccountTransaction) =>
    new BigNumber(transaction.amount).isEqualTo(0) &&
    D.isNotEmpty(transaction.tokens) &&
    transaction.tokens.every(token => new BigNumber(token.amount).isEqualTo(0));

export const getIsFakeTokenPhishing = (
    transaction: WalletAccountTransaction,
    tokenDefinitions: TokenDefinitions,
) =>
    new BigNumber(transaction.amount).isEqualTo(0) && // native currency is zero
    D.isNotEmpty(transaction.tokens) && // there are tokens in tx
    transaction.tokens.every(tokenTx => !isNftTokenTransfer(tokenTx)) && // non-nfts
    !transaction.tokens.some(tokenTx => tokenDefinitions[tokenTx.contract]?.isTokenKnown); // all tokens are unknown

// TEMP: solution to tag all NFT txs on Polygon PoS as scam before we introduce NFT definitions
export const getIsPolygonNftTransaction = (transaction: WalletAccountTransaction) =>
    transaction.symbol === 'matic' &&
    transaction.tokens.some(tokenTx => isNftTokenTransfer(tokenTx));

export const getIsPhishingTransaction = (
    transaction: WalletAccountTransaction,
    tokenDefinitions: TokenDefinitions,
) =>
    getIsZeroValuePhishing(transaction) ||
    getIsPolygonNftTransaction(transaction) ||
    (D.isNotEmpty(tokenDefinitions) && // at least one token definition is available
        getIsFakeTokenPhishing(transaction, tokenDefinitions));
