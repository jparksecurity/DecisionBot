# WalletService

A list of all methods in the `WalletService` service. Click on the method name to view detailed information about that method.

| Methods                                                             | Description                                        |
| :------------------------------------------------------------------ | :------------------------------------------------- |
| [walletGetAccountInfo](#walletgetaccountinfo)                       | Get account info for current user                  |
| [walletGetBalance](#walletgetbalance)                               | Get wallet balance for current user                |
| [walletGenerateBillingPortal](#walletgeneratebillingportal)         | Generate a URL to the billing portal               |
| [walletCancelTopUpRequest](#walletcanceltopuprequest)               | Cancel a top up request and update state           |
| [walletGetExchangeRate](#walletgetexchangerate)                     | Convert amount from currency to ByteChips          |
| [walletRequirePayout](#walletrequirepayout)                         | Require a cash payout or swap credit for prizes    |
| [walletPayoutHistory](#walletpayouthistory)                         | Retrieve paginated payout history for current user |
| [walletRedeemCoupon](#walletredeemcoupon)                           | Redeem a promo code                                |
| [walletCreateTopUpRequest](#walletcreatetopuprequest)               | Create a top up request and get the payment code   |
| [walletGetTransactionList](#walletgettransactionlist)               | Get paginated list of transactions                 |
| [walletGetTransactionsCsv](#walletgettransactionscsv)               | Get CSV of all transactions                        |
| [walletPostTransactionListFilter](#walletposttransactionlistfilter) | post paginated list of transactions with filters   |
| [walletForcefulBalanceRecovery](#walletforcefulbalancerecovery)     | Forcefully monthly recover balance                 |

## walletGetAccountInfo

Get account info for current user

- HTTP Method: `GET`
- Endpoint: `/account`

**Return Type**

`WalletAccountResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletGetAccountInfo();

  console.log(data);
})();
```

## walletGetBalance

Get wallet balance for current user

- HTTP Method: `GET`
- Endpoint: `/balance`

**Return Type**

`WalletGetBalanceResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletGetBalance();

  console.log(data);
})();
```

## walletGenerateBillingPortal

Generate a URL to the billing portal

- HTTP Method: `GET`
- Endpoint: `/billing_portal`

**Return Type**

`WalletGeneratePayoutPortalLinkResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletGenerateBillingPortal();

  console.log(data);
})();
```

## walletCancelTopUpRequest

Cancel a top up request and update state

- HTTP Method: `POST`
- Endpoint: `/cancel_top_up`

**Parameters**

| Name | Type                                                                                | Required | Description       |
| :--- | :---------------------------------------------------------------------------------- | :------- | :---------------- |
| body | [WalletApiCancelTopUpRequestParams](../models/WalletApiCancelTopUpRequestParams.md) | ✅       | The request body. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi, WalletApiCancelTopUpRequestParams } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const walletApiCancelTopUpRequestParams: WalletApiCancelTopUpRequestParams = {
    id: 'id',
    cancelMessage: 'cancelMessage',
  };

  const { data } = await byteNiteWalletApi.wallet.walletCancelTopUpRequest(walletApiCancelTopUpRequestParams);

  console.log(data);
})();
```

## walletGetExchangeRate

Convert amount from currency to ByteChips

- HTTP Method: `GET`
- Endpoint: `/exchange_rate`

**Parameters**

| Name           | Type   | Required | Description |
| :------------- | :----- | :------- | :---------- |
| currency       | string | ❌       |             |
| currencyAmount | number | ❌       |             |
| amount         | number | ❌       |             |

**Return Type**

`ResponseMessages`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletGetExchangeRate({
    currency: 'currency',
    currencyAmount: 2.37,
    amount: 8.12,
  });

  console.log(data);
})();
```

## walletRequirePayout

Require a cash payout or swap credit for prizes

- HTTP Method: `POST`
- Endpoint: `/payout`

**Parameters**

| Name | Type                                                    | Required | Description       |
| :--- | :------------------------------------------------------ | :------- | :---------------- |
| body | [WalletPayoutRequest](../models/WalletPayoutRequest.md) | ✅       | The request body. |

**Return Type**

`WalletRequirePayoutResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi, WalletPayoutRequest } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const todoState = 'NEW';

  const walletPayoutRequest: WalletPayoutRequest = {
    id: 'id',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
    ownerId: 'ownerId',
    accountId: 'accountId',
    payoutProfileId: 'payoutProfileId',
    amount: 'amount',
    currency: 'currency',
    currencyAmount: 'currencyAmount',
    exchangeRate: 'exchangeRate',
    state: todoState,
    sentAt: 'sentAt',
    confirmedAt: 'confirmedAt',
  };

  const { data } = await byteNiteWalletApi.wallet.walletRequirePayout(walletPayoutRequest);

  console.log(data);
})();
```

## walletPayoutHistory

Retrieve paginated payout history for current user

- HTTP Method: `GET`
- Endpoint: `/payout_history`

**Parameters**

| Name   | Type   | Required | Description                                                       |
| :----- | :----- | :------- | :---------------------------------------------------------------- |
| limit  | number | ❌       | Number of rows to return per page.                                |
| offset | number | ❌       | Number of rows to skip before starting to collect the result set. |

**Return Type**

`WalletPayoutRequestFilterResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletPayoutHistory({
    limit: 4,
    offset: 7,
  });

  console.log(data);
})();
```

## walletRedeemCoupon

Redeem a promo code

- HTTP Method: `POST`
- Endpoint: `/redeem_coupon`

**Parameters**

| Name | Type                                                                                      | Required | Description       |
| :--- | :---------------------------------------------------------------------------------------- | :------- | :---------------- |
| body | [BytenitewalletApiRedeemCouponRequest](../models/BytenitewalletApiRedeemCouponRequest.md) | ✅       | The request body. |

**Return Type**

`WalletApiRedeemCouponResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi, BytenitewalletApiRedeemCouponRequest } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const bytenitewalletApiRedeemCouponRequest: BytenitewalletApiRedeemCouponRequest = {
    couponCode: 'hello-world',
  };

  const { data } = await byteNiteWalletApi.wallet.walletRedeemCoupon(bytenitewalletApiRedeemCouponRequest);

  console.log(data);
})();
```

## walletCreateTopUpRequest

Create a top up request and get the payment code

- HTTP Method: `POST`
- Endpoint: `/top_up`

**Parameters**

| Name | Type                                                                    | Required | Description       |
| :--- | :---------------------------------------------------------------------- | :------- | :---------------- |
| body | [WalletApiTopUpRequestParams](../models/WalletApiTopUpRequestParams.md) | ✅       | The request body. |

**Return Type**

`WalletTopUpResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi, WalletApiTopUpRequestParams } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const walletApiTopUpRequestParams: WalletApiTopUpRequestParams = {
    currencyAmount: 'currencyAmount',
    currency: 'currency',
    amount: 'amount',
  };

  const { data } = await byteNiteWalletApi.wallet.walletCreateTopUpRequest(walletApiTopUpRequestParams);

  console.log(data);
})();
```

## walletGetTransactionList

Get paginated list of transactions

- HTTP Method: `GET`
- Endpoint: `/transactions`

**Parameters**

| Name             | Type   | Required | Description                                                       |
| :--------------- | :----- | :------- | :---------------------------------------------------------------- |
| paginationLimit  | number | ❌       | Number of rows to return per page.                                |
| paginationOffset | number | ❌       | Number of rows to skip before starting to collect the result set. |
| orderBy          | string | ❌       |                                                                   |

**Return Type**

`WalletTransactionHistoryResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletGetTransactionList({
    paginationLimit: 8,
    paginationOffset: 10,
    orderBy: 'orderBy',
  });

  console.log(data);
})();
```

## walletGetTransactionsCsv

Get CSV of all transactions

- HTTP Method: `GET`
- Endpoint: `/transactions/csv`

**Return Type**

`WalletTransactionHistoryCsvResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletGetTransactionsCsv();

  console.log(data);
})();
```

## walletPostTransactionListFilter

post paginated list of transactions with filters

- HTTP Method: `POST`
- Endpoint: `/transactions/filter`

**Parameters**

| Name | Type                                                                                  | Required | Description       |
| :--- | :------------------------------------------------------------------------------------ | :------- | :---------------- |
| body | [WalletApiGetAllTransactionsRequest](../models/WalletApiGetAllTransactionsRequest.md) | ✅       | The request body. |

**Return Type**

`WalletTransactionHistoryResponse`

**Example Usage Code Snippet**

```typescript
import {
  ByteNiteWalletApi,
  CommonFilter,
  CommonLimitOffsetPagination,
  WalletApiGetAllTransactionsRequest,
} from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const commonLimitOffsetPagination: CommonLimitOffsetPagination = {
    limit: 123,
    offset: 9,
  };

  const commonFilterCondition = 'FILTER_CONDITION_EQ';

  const protobufAny: ProtobufAny = {
    _type: '@type',
  };

  const commonFilter: CommonFilter = {
    field: 'field',
    condition: commonFilterCondition,
    value: protobufAny,
  };

  const walletApiGetAllTransactionsRequest: WalletApiGetAllTransactionsRequest = {
    pagination: commonLimitOffsetPagination,
    filters: [commonFilter],
    orderBy: 'orderBy',
  };

  const { data } = await byteNiteWalletApi.wallet.walletPostTransactionListFilter(walletApiGetAllTransactionsRequest);

  console.log(data);
})();
```

## walletForcefulBalanceRecovery

Forcefully monthly recover balance

- HTTP Method: `POST`
- Endpoint: `/triggers/forceful_balance_recovery`

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteWalletApi } from 'bytenite wallet api';

(async () => {
  const byteNiteWalletApi = new ByteNiteWalletApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteWalletApi.wallet.walletForcefulBalanceRecovery();

  console.log(data);
})();
```

<!-- This file was generated by liblab | https://liblab.com/ -->
