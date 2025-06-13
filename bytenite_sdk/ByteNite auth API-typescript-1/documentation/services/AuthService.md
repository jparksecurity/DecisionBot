# AuthService

A list of all methods in the `AuthService` service. Click on the method name to view detailed information about that method.

| Methods                                           | Description                                                                                   |
| :------------------------------------------------ | :-------------------------------------------------------------------------------------------- |
| [authRequestAccessToken](#authrequestaccesstoken) | Exchange an API key for an oAuth2 access token                                                |
| [authRequestApiKey](#authrequestapikey)           | Exchange the OTP code for an API key that could be used for authentication                    |
| [authAuthenticate](#authauthenticate)             | Validate the OTP code to authenticate the user                                                |
| [authRequestSignInCode](#authrequestsignincode)   | Require an email with an OTP code that could be used to obtain an ID token                    |
| [authSignOut](#authsignout)                       | Log out current user and invalidates token                                                    |
| [authSkipLogin](#authskiplogin)                   | Check if the user is already logged in, if the user can skip login a redirect url is returned |

## authRequestAccessToken

Exchange an API key for an oAuth2 access token

- HTTP Method: `POST`
- Endpoint: `/access_token`

**Parameters**

| Name | Type                                                          | Required | Description       |
| :--- | :------------------------------------------------------------ | :------- | :---------------- |
| body | [AuthAccessTokenRequest](../models/AuthAccessTokenRequest.md) | ✅       | The request body. |

**Return Type**

`AuthAccessTokenResponse`

**Example Usage Code Snippet**

```typescript
import { AuthAccessTokenRequest, ByteNiteAuthApi } from 'bytenite auth api';

(async () => {
  const byteNiteAuthApi = new ByteNiteAuthApi({
    token: 'YOUR_TOKEN',
  });

  const authAccessTokenRequest: AuthAccessTokenRequest = {
    apiKey: 'eyJjcnYiOiJQLTM4NCIsImQiOiJyM1VFQ21naUNiNjI1c19CZWc3emdULUlCajJUOUZW...',
  };

  const { data } = await byteNiteAuthApi.auth.authRequestAccessToken(authAccessTokenRequest);

  console.log(data);
})();
```

## authRequestApiKey

Exchange the OTP code for an API key that could be used for authentication

- HTTP Method: `POST`
- Endpoint: `/api_key`

**Parameters**

| Name | Type                                                | Required | Description       |
| :--- | :-------------------------------------------------- | :------- | :---------------- |
| body | [AuthApiKeyRequest](../models/AuthApiKeyRequest.md) | ✅       | The request body. |

**Return Type**

`AuthApiKeyResponse`

**Example Usage Code Snippet**

```typescript
import { AuthApiKeyRequest, ByteNiteAuthApi } from 'bytenite auth api';

(async () => {
  const byteNiteAuthApi = new ByteNiteAuthApi({
    token: 'YOUR_TOKEN',
  });

  const authApiKeyRequest: AuthApiKeyRequest = {
    name: 'My API key',
    code: '123456',
    nonce: 'nonce',
    duration: 'duration',
  };

  const { data } = await byteNiteAuthApi.auth.authRequestApiKey(authApiKeyRequest);

  console.log(data);
})();
```

## authAuthenticate

Validate the OTP code to authenticate the user

- HTTP Method: `POST`
- Endpoint: `/authenticate`

**Parameters**

| Name | Type                                              | Required | Description       |
| :--- | :------------------------------------------------ | :------- | :---------------- |
| body | [AuthTokenRequest](../models/AuthTokenRequest.md) | ✅       | The request body. |

**Return Type**

`AuthAuthenticationResponse`

**Example Usage Code Snippet**

```typescript
import { AuthTokenRequest, ByteNiteAuthApi } from 'bytenite auth api';

(async () => {
  const byteNiteAuthApi = new ByteNiteAuthApi({
    token: 'YOUR_TOKEN',
  });

  const authTokenRequest: AuthTokenRequest = {
    email: 'email',
    deviceId: 'deviceId',
    code: 'code',
    nonce: 'nonce',
    loginChallenge: 'loginChallenge',
  };

  const { data } = await byteNiteAuthApi.auth.authAuthenticate(authTokenRequest);

  console.log(data);
})();
```

## authRequestSignInCode

Require an email with an OTP code that could be used to obtain an ID token

- HTTP Method: `POST`
- Endpoint: `/signin`

**Parameters**

| Name | Type                                            | Required | Description       |
| :--- | :---------------------------------------------- | :------- | :---------------- |
| body | [TodoClientNonce](../models/TodoClientNonce.md) | ✅       | The request body. |

**Return Type**

`AuthSignInResponse`

**Example Usage Code Snippet**

```typescript
import { AuthContactInfo, ByteNiteAuthApi, TodoClientNonce } from 'bytenite auth api';

(async () => {
  const byteNiteAuthApi = new ByteNiteAuthApi({
    token: 'YOUR_TOKEN',
  });

  const authContactInfo: AuthContactInfo = {
    company: 'ByteNite',
    jobTitle: 'Software Engineer',
    phoneNumber: '1234567890',
    address1: '1234 Main St',
    address2: 'Apt 123',
    city: 'San Francisco',
    state: 'CA',
    zip: '94107',
    country: 'United States',
  };

  const todoClientNonce: TodoClientNonce = {
    email: 'email',
    firstName: 'firstName',
    lastName: 'lastName',
    isNewUser: true,
    accessCode: 'accessCode',
    contactInfo: authContactInfo,
  };

  const { data } = await byteNiteAuthApi.auth.authRequestSignInCode(todoClientNonce);

  console.log(data);
})();
```

## authSignOut

Log out current user and invalidates token

- HTTP Method: `POST`
- Endpoint: `/signout`

**Parameters**

| Name | Type | Required | Description       |
| :--- | :--- | :------- | :---------------- |
| body | any  | ✅       | The request body. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteAuthApi } from 'bytenite auth api';

(async () => {
  const byteNiteAuthApi = new ByteNiteAuthApi({
    token: 'YOUR_TOKEN',
  });

  const input = {};

  const { data } = await byteNiteAuthApi.auth.authSignOut({});

  console.log(data);
})();
```

## authSkipLogin

Check if the user is already logged in, if the user can skip login a redirect url is returned

- HTTP Method: `GET`
- Endpoint: `/skip`

**Parameters**

| Name           | Type   | Required | Description |
| :------------- | :----- | :------- | :---------- |
| loginChallenge | string | ❌       |             |

**Return Type**

`AuthLoginChallengeResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteAuthApi } from 'bytenite auth api';

(async () => {
  const byteNiteAuthApi = new ByteNiteAuthApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteAuthApi.auth.authSkipLogin({
    loginChallenge: 'loginChallenge',
  });

  console.log(data);
})();
```

<!-- This file was generated by liblab | https://liblab.com/ -->
