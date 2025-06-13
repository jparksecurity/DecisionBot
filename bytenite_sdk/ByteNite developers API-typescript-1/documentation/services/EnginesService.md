# EnginesService

A list of all methods in the `EnginesService` service. Click on the method name to view detailed information about that method.

| Methods                                                 | Description                        |
| :------------------------------------------------------ | :--------------------------------- |
| [developerGetEngines](#developergetengines)             | List all engines owned by the user |
| [developerUploadEngine](#developeruploadengine)         | Upload a engine to the server      |
| [developerGetEngineByTag](#developergetenginebytag)     | Get an engine by tag               |
| [developerActivateEngine](#developeractivateengine)     | Activate an Engine                 |
| [developerDeactivateEngine](#developerdeactivateengine) | Deactivate an Engine               |
| [developerGetEngineLink](#developergetenginelink)       | Download an Engine                 |
| [developerGetEngineStatus](#developergetenginestatus)   | Get status of engine               |

## developerGetEngines

List all engines owned by the user

- HTTP Method: `GET`
- Endpoint: `/engines`

**Parameters**

| Name             | Type   | Required | Description                                                       |
| :--------------- | :----- | :------- | :---------------------------------------------------------------- |
| orderBy          | string | ❌       | Field name to sort apps by (e.g., createdAt).                     |
| paginationLimit  | number | ❌       | Number of rows to return per page.                                |
| paginationOffset | number | ❌       | Number of rows to skip before starting to collect the result set. |

**Return Type**

`ArrayOfEngine`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.engines.developerGetEngines({
    orderBy: 'orderBy',
    paginationLimit: 5,
    paginationOffset: 3,
  });

  console.log(data);
})();
```

## developerUploadEngine

Upload a engine to the server

- HTTP Method: `POST`
- Endpoint: `/engines`

**Parameters**

| Name         | Type   | Required | Description |
| :----------- | :----- | :------- | :---------- |
| engineId     | string | ❌       |             |
| engineTag    | string | ❌       |             |
| engineData   | string | ❌       |             |
| engineLink   | string | ❌       |             |
| engineStatus | string | ❌       |             |

**Return Type**

`RepresentsAnEngineAndItsMetadata`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.engines.developerUploadEngine({
    engineId: 'engineId',
    engineTag: 'engineTag',
    engineData: 'engineData',
    engineLink: 'engineLink',
    engineStatus: 'engineStatus',
  });

  console.log(data);
})();
```

## developerGetEngineByTag

Get an engine by tag

- HTTP Method: `GET`
- Endpoint: `/engines/{engineTag}`

**Parameters**

| Name         | Type   | Required | Description |
| :----------- | :----- | :------- | :---------- |
| engineTag    | string | ✅       |             |
| engineId     | string | ❌       |             |
| engineData   | string | ❌       |             |
| engineLink   | string | ❌       |             |
| engineStatus | string | ❌       |             |

**Return Type**

`RepresentsAnEngineAndItsMetadata`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.engines.developerGetEngineByTag('engineTag', {
    engineId: 'engineId',
    engineData: 'engineData',
    engineLink: 'engineLink',
    engineStatus: 'engineStatus',
  });

  console.log(data);
})();
```

## developerActivateEngine

Activate an Engine

- HTTP Method: `POST`
- Endpoint: `/engines/{engineTag}/activate`

**Parameters**

| Name         | Type   | Required | Description |
| :----------- | :----- | :------- | :---------- |
| engineTag    | string | ✅       |             |
| engineId     | string | ❌       |             |
| engineData   | string | ❌       |             |
| engineLink   | string | ❌       |             |
| engineStatus | string | ❌       |             |

**Return Type**

`DeveloperEngineMessage`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.engines.developerActivateEngine('engineTag', {
    engineId: 'engineId',
    engineData: 'engineData',
    engineLink: 'engineLink',
    engineStatus: 'engineStatus',
  });

  console.log(data);
})();
```

## developerDeactivateEngine

Deactivate an Engine

- HTTP Method: `POST`
- Endpoint: `/engines/{engineTag}/deactivate`

**Parameters**

| Name         | Type   | Required | Description |
| :----------- | :----- | :------- | :---------- |
| engineTag    | string | ✅       |             |
| engineId     | string | ❌       |             |
| engineData   | string | ❌       |             |
| engineLink   | string | ❌       |             |
| engineStatus | string | ❌       |             |

**Return Type**

`DeveloperEngineMessage`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.engines.developerDeactivateEngine('engineTag', {
    engineId: 'engineId',
    engineData: 'engineData',
    engineLink: 'engineLink',
    engineStatus: 'engineStatus',
  });

  console.log(data);
})();
```

## developerGetEngineLink

Download an Engine

- HTTP Method: `GET`
- Endpoint: `/engines/{engineTag}/download`

**Parameters**

| Name         | Type   | Required | Description |
| :----------- | :----- | :------- | :---------- |
| engineTag    | string | ✅       |             |
| engineId     | string | ❌       |             |
| engineData   | string | ❌       |             |
| engineLink   | string | ❌       |             |
| engineStatus | string | ❌       |             |

**Return Type**

`DeveloperEngineMessage`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.engines.developerGetEngineLink('engineTag', {
    engineId: 'engineId',
    engineData: 'engineData',
    engineLink: 'engineLink',
    engineStatus: 'engineStatus',
  });

  console.log(data);
})();
```

## developerGetEngineStatus

Get status of engine

- HTTP Method: `GET`
- Endpoint: `/engines/{engineTag}/status`

**Parameters**

| Name         | Type   | Required | Description |
| :----------- | :----- | :------- | :---------- |
| engineTag    | string | ✅       |             |
| engineId     | string | ❌       |             |
| engineData   | string | ❌       |             |
| engineLink   | string | ❌       |             |
| engineStatus | string | ❌       |             |

**Return Type**

`DeveloperEngineMessage`

**Example Usage Code Snippet**

```typescript
import { ByteNiteDevelopersApi } from 'bytenite developers api';

(async () => {
  const byteNiteDevelopersApi = new ByteNiteDevelopersApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteDevelopersApi.engines.developerGetEngineStatus('engineTag', {
    engineId: 'engineId',
    engineData: 'engineData',
    engineLink: 'engineLink',
    engineStatus: 'engineStatus',
  });

  console.log(data);
})();
```

<!-- This file was generated by liblab | https://liblab.com/ -->
