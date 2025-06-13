# AppsService

A list of all methods in the `AppsService` service. Click on the method name to view detailed information about that method.

| Methods                                                     | Description                                                                                         |
| :---------------------------------------------------------- | :-------------------------------------------------------------------------------------------------- |
| [developerGetApps](#developergetapps)                       | List all distributed apps created by the user. Use this endpoint to fetch apps created by the user. |
| [developerUploadApp](#developeruploadapp)                   | Upload a distributed app to the server                                                              |
| [developerGetAppByTag](#developergetappbytag)               | Get the latest app de                                                                               |
| [developerActivateApp](#developeractivateapp)               | Activate a distributed app                                                                          |
| [developerDeactivateApp](#developerdeactivateapp)           | Activate a distributed app                                                                          |
| [developerGetAppDownloadLink](#developergetappdownloadlink) | Get download link for an app                                                                        |
| [developerGetAppStatus](#developergetappstatus)             | Get status of app                                                                                   |

## developerGetApps

List all distributed apps created by the user. Use this endpoint to fetch apps created by the user.

- HTTP Method: `GET`
- Endpoint: `/apps`

**Parameters**

| Name             | Type   | Required | Description                                                       |
| :--------------- | :----- | :------- | :---------------------------------------------------------------- |
| orderBy          | string | ❌       | Field name to sort apps by (e.g., createdAt).                     |
| paginationLimit  | number | ❌       | Number of rows to return per page.                                |
| paginationOffset | number | ❌       | Number of rows to skip before starting to collect the result set. |

**Return Type**

`DeveloperAppListResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.apps.developerGetApps({
    orderBy: 'orderBy',
    paginationLimit: 5,
    paginationOffset: 2,
  });

  console.log(data);
})();
```

## developerUploadApp

Upload a distributed app to the server

- HTTP Method: `POST`
- Endpoint: `/apps`

**Parameters**

| Name | Type                                                                | Required | Description       |
| :--- | :------------------------------------------------------------------ | :------- | :---------------- |
| body | [DeveloperUploadAppRequest](../models/DeveloperUploadAppRequest.md) | ✅       | The request body. |

**Return Type**

`ByteniteappApp`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi, DeveloperUploadAppRequest } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const developerUploadAppRequest: DeveloperUploadAppRequest = {
    data: 'data',
  };

  const { data } = await byteNiteDevelopersApi.apps.developerUploadApp(developerUploadAppRequest);

  console.log(data);
})();
```

## developerGetAppByTag

Get the latest app de

- HTTP Method: `GET`
- Endpoint: `/apps/{appTag}`

**Parameters**

| Name   | Type   | Required | Description                                                  |
| :----- | :----- | :------- | :----------------------------------------------------------- |
| appTag | string | ✅       | Unique tag or ID of the app to generate a download link for. |

**Return Type**

`Responses`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.apps.developerGetAppByTag('appTag');

  console.log(data);
})();
```

## developerActivateApp

Activate a distributed app

- HTTP Method: `POST`
- Endpoint: `/apps/{appTag}/activate`

**Parameters**

| Name   | Type   | Required | Description                                                  |
| :----- | :----- | :------- | :----------------------------------------------------------- |
| appTag | string | ✅       | Unique tag or ID of the app to generate a download link for. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.apps.developerActivateApp('appTag');

  console.log(data);
})();
```

## developerDeactivateApp

Activate a distributed app

- HTTP Method: `POST`
- Endpoint: `/apps/{appTag}/deactivate`

**Parameters**

| Name   | Type   | Required | Description                                                  |
| :----- | :----- | :------- | :----------------------------------------------------------- |
| appTag | string | ✅       | Unique tag or ID of the app to generate a download link for. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.apps.developerDeactivateApp('appTag');

  console.log(data);
})();
```

## developerGetAppDownloadLink

Get download link for an app

- HTTP Method: `GET`
- Endpoint: `/apps/{appTag}/download`

**Parameters**

| Name   | Type   | Required | Description                                                  |
| :----- | :----- | :------- | :----------------------------------------------------------- |
| appTag | string | ✅       | Unique tag or ID of the app to generate a download link for. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.apps.developerGetAppDownloadLink('appTag');

  console.log(data);
})();
```

## developerGetAppStatus

Get status of app

- HTTP Method: `GET`
- Endpoint: `/apps/{appTag}/status`

**Parameters**

| Name   | Type   | Required | Description                                                  |
| :----- | :----- | :------- | :----------------------------------------------------------- |
| appTag | string | ✅       | Unique tag or ID of the app to generate a download link for. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.apps.developerGetAppStatus('appTag');

  console.log(data);
})();
```

<!-- This file was generated by liblab | https://liblab.com/ -->
