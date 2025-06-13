# JobsService

A list of all methods in the `JobsService` service. Click on the method name to view detailed information about that method.

| Methods                                                     | Description                                                                |
| :---------------------------------------------------------- | :------------------------------------------------------------------------- |
| [customerDataSourceInfo](#customerdatasourceinfo)           | Test and get information about a data source connection                    |
| [customerGetAll](#customergetall)                           | Get all jobs for user with optional filters                                |
| [customerCreateJob](#customercreatejob)                     | Create a new computing job on ByteNite.                                    |
| [customerGetAllFiltered](#customergetallfiltered)           | Get all jobs for user and filter them                                      |
| [customerGetJobsRunningTasks](#customergetjobsrunningtasks) | Get the number of running tasks for the jobs                               |
| [customerGetJobTemplates](#customergetjobtemplates)         | Get available job templates                                                |
| [customerGetJobPresets](#customergetjobpresets)             | Get available job presets for a job template.                              |
| [customerGetJob](#customergetjob)                           | Get job properties                                                         |
| [customerDeleteJob](#customerdeletejob)                     | Delete a job                                                               |
| [customerAbortJob](#customerabortjob)                       | Abort running job (an incomplete job that is yet to start will be deleted) |
| [customerSetJobPreferences](#customersetjobpreferences)     | Set or update execution parameters/configurations                          |
| [customerSetJobDataSource](#customersetjobdatasource)       | Set a job datasource                                                       |
| [customerSetJobName](#customersetjobname)                   | Set a job name                                                             |
| [customerSetJobParams](#customersetjobparams)               | Set or update job specific parameters                                      |
| [customerGetJobResults](#customergetjobresults)             | Get job results                                                            |
| [customerRunJob](#customerrunjob)                           | Run a job                                                                  |
| [customerSetUploadCompleted](#customersetuploadcompleted)   | Set a job local file upload completed                                      |

## customerDataSourceInfo

Test and get information about a data source connection

- HTTP Method: `POST`
- Endpoint: `/datasource/test`

**Parameters**

| Name | Type                                                                | Required | Description       |
| :--- | :------------------------------------------------------------------ | :------- | :---------------- |
| body | [JobsDataSourceInfoRequest](../models/JobsDataSourceInfoRequest.md) | ✅       | The request body. |

**Return Type**

`JobsDataSourceInfoResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi, DataSourceDataSource, JobsDataSourceInfoRequest } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const protobufAny: ProtobufAny = {
    _type: '@type',
  };

  const dataSourceDataSource: DataSourceDataSource = {
    dataSourceDescriptor: 's3',
    params: protobufAny,
  };

  const jobsDataSourceInfoRequest: JobsDataSourceInfoRequest = {
    dataSource: dataSourceDataSource,
    listFiles: true,
  };

  const { data } = await byteNiteJobsApi.jobs.customerDataSourceInfo(jobsDataSourceInfoRequest);

  console.log(data);
})();
```

## customerGetAll

Get all jobs for user with optional filters

- HTTP Method: `GET`
- Endpoint: `/jobs`

**Parameters**

| Name             | Type   | Required | Description                                                       |
| :--------------- | :----- | :------- | :---------------------------------------------------------------- |
| paginationLimit  | number | ❌       | Number of rows to return per page.                                |
| paginationOffset | number | ❌       | Number of rows to skip before starting to collect the result set. |
| orderBy          | string | ❌       |                                                                   |

**Return Type**

`JobsJobsResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerGetAll({
    paginationLimit: 5,
    paginationOffset: 5,
    orderBy: 'orderBy',
  });

  console.log(data);
})();
```

## customerCreateJob

Create a new computing job on ByteNite.

- HTTP Method: `POST`
- Endpoint: `/jobs`

**Parameters**

| Name | Type                                                      | Required | Description       |
| :--- | :-------------------------------------------------------- | :------- | :---------------- |
| body | [JobsCreateJobRequest](../models/JobsCreateJobRequest.md) | ✅       | The request body. |

**Return Type**

`JobsJobResponse`

**Example Usage Code Snippet**

```typescript
import {
  ByteNiteJobsApi,
  DataSourceDataSource,
  JobAppParams,
  JobJobConfig,
  JobsCreateJobRequest,
} from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const protobufAny: ProtobufAny = {
    _type: '@type',
  };

  const dataSourceDataSource: DataSourceDataSource = {
    dataSourceDescriptor: 's3',
    params: protobufAny,
  };

  const jobAppParams: JobAppParams = {
    preset: 'preset',
    partitioner: {},
    assembler: {},
    app: {},
  };

  const jobJobConfig: JobJobConfig = {
    taskTimeout: 7,
    jobTimeout: 10,
    isTestJob: true,
  };

  const jobsCreateJobRequest: JobsCreateJobRequest = {
    jobId: 'jobId',
    name: 'name',
    templateId: 'templateId',
    description: 'description',
    dataSource: dataSourceDataSource,
    dataDestination: dataSourceDataSource,
    params: jobAppParams,
    config: jobJobConfig,
  };

  const { data } = await byteNiteJobsApi.jobs.customerCreateJob(jobsCreateJobRequest);

  console.log(data);
})();
```

## customerGetAllFiltered

Get all jobs for user and filter them

- HTTP Method: `POST`
- Endpoint: `/jobs/filter`

**Parameters**

| Name | Type                                                                | Required | Description       |
| :--- | :------------------------------------------------------------------ | :------- | :---------------- |
| body | [CustomerGetAllJobsRequest](../models/CustomerGetAllJobsRequest.md) | ✅       | The request body. |

**Return Type**

`JobsJobsResponse`

**Example Usage Code Snippet**

```typescript
import {
  ByteNiteJobsApi,
  CommonFilter,
  CommonLimitOffsetPagination,
  CustomerGetAllJobsRequest,
} from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const commonLimitOffsetPagination: CommonLimitOffsetPagination = {
    limit: 3,
    offset: 1,
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

  const customerGetAllJobsRequest: CustomerGetAllJobsRequest = {
    pagination: commonLimitOffsetPagination,
    filters: [commonFilter],
    orderBy: 'orderBy',
  };

  const { data } = await byteNiteJobsApi.jobs.customerGetAllFiltered(customerGetAllJobsRequest);

  console.log(data);
})();
```

## customerGetJobsRunningTasks

Get the number of running tasks for the jobs

- HTTP Method: `POST`
- Endpoint: `/jobs/runningTasks`

**Parameters**

| Name | Type                                                                            | Required | Description       |
| :--- | :------------------------------------------------------------------------------ | :------- | :---------------- |
| body | [CustomerJobsRunningTasksRequest](../models/CustomerJobsRunningTasksRequest.md) | ✅       | The request body. |

**Return Type**

`CustomerJobsRunningTasksResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi, CustomerJobsRunningTasksRequest } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const customerJobsRunningTasksRequest: CustomerJobsRunningTasksRequest = {
    jobsIds: ['jobsIds'],
  };

  const { data } = await byteNiteJobsApi.jobs.customerGetJobsRunningTasks(customerJobsRunningTasksRequest);

  console.log(data);
})();
```

## customerGetJobTemplates

Get available job templates

- HTTP Method: `GET`
- Endpoint: `/jobs/templates`

**Parameters**

| Name             | Type   | Required | Description                                                       |
| :--------------- | :----- | :------- | :---------------------------------------------------------------- |
| paginationLimit  | number | ❌       | Number of rows to return per page.                                |
| paginationOffset | number | ❌       | Number of rows to skip before starting to collect the result set. |

**Return Type**

`JobsJobTemplatesResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerGetJobTemplates({
    paginationLimit: 4,
    paginationOffset: 1,
  });

  console.log(data);
})();
```

## customerGetJobPresets

Get available job presets for a job template.

- HTTP Method: `GET`
- Endpoint: `/jobs/templates/{jobTemplateId}/presets`

**Parameters**

| Name          | Type   | Required | Description |
| :------------ | :----- | :------- | :---------- |
| jobTemplateId | string | ✅       |             |

**Return Type**

`JobsJobPresetsResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerGetJobPresets('jobTemplateId');

  console.log(data);
})();
```

## customerGetJob

Get job properties

- HTTP Method: `GET`
- Endpoint: `/jobs/{jobId}`

**Parameters**

| Name  | Type   | Required | Description                      |
| :---- | :----- | :------- | :------------------------------- |
| jobId | string | ✅       | The id associated with your job. |

**Return Type**

`JobsJobResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerGetJob('jobId');

  console.log(data);
})();
```

## customerDeleteJob

Delete a job

- HTTP Method: `DELETE`
- Endpoint: `/jobs/{jobId}`

**Parameters**

| Name  | Type   | Required | Description                      |
| :---- | :----- | :------- | :------------------------------- |
| jobId | string | ✅       | The id associated with your job. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerDeleteJob('jobId');

  console.log(data);
})();
```

## customerAbortJob

Abort running job (an incomplete job that is yet to start will be deleted)

- HTTP Method: `POST`
- Endpoint: `/jobs/{jobId}/abort`

**Parameters**

| Name  | Type   | Required | Description                      |
| :---- | :----- | :------- | :------------------------------- |
| jobId | string | ✅       | The id associated with your job. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerAbortJob('jobId');

  console.log(data);
})();
```

## customerSetJobPreferences

Set or update execution parameters/configurations

- HTTP Method: `PATCH`
- Endpoint: `/jobs/{jobId}/configs`

**Parameters**

| Name  | Type                                      | Required | Description                      |
| :---- | :---------------------------------------- | :------- | :------------------------------- |
| body  | [JobJobConfig](../models/JobJobConfig.md) | ✅       | The request body.                |
| jobId | string                                    | ✅       | The id associated with your job. |

**Return Type**

`JobsJobResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi, JobJobConfig } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const jobJobConfig: JobJobConfig = {
    taskTimeout: 7,
    jobTimeout: 10,
    isTestJob: true,
  };

  const { data } = await byteNiteJobsApi.jobs.customerSetJobPreferences('jobId', jobJobConfig);

  console.log(data);
})();
```

## customerSetJobDataSource

Set a job datasource

- HTTP Method: `PATCH`
- Endpoint: `/jobs/{jobId}/datasource`

**Parameters**

| Name  | Type                                                      | Required | Description                      |
| :---- | :-------------------------------------------------------- | :------- | :------------------------------- |
| body  | [JobsDataSourceParams](../models/JobsDataSourceParams.md) | ✅       | The request body.                |
| jobId | string                                                    | ✅       | The id associated with your job. |

**Return Type**

`JobsJobResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi, DataSourceDataSource, JobsDataSourceParams } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const protobufAny: ProtobufAny = {
    _type: '@type',
  };

  const dataSourceDataSource: DataSourceDataSource = {
    dataSourceDescriptor: 's3',
    params: protobufAny,
  };

  const jobsDataSourceParams: JobsDataSourceParams = {
    dataSource: dataSourceDataSource,
    dataDestination: dataSourceDataSource,
  };

  const { data } = await byteNiteJobsApi.jobs.customerSetJobDataSource('jobId', jobsDataSourceParams);

  console.log(data);
})();
```

## customerSetJobName

Set a job name

- HTTP Method: `PATCH`
- Endpoint: `/jobs/{jobId}/jobname`

**Parameters**

| Name  | Type   | Required | Description                      |
| :---- | :----- | :------- | :------------------------------- |
| body  | string | ✅       | The request body.                |
| jobId | string | ✅       | The id associated with your job. |

**Return Type**

`JobsJobResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerSetJobName('jobId', '');

  console.log(data);
})();
```

## customerSetJobParams

Set or update job specific parameters

- HTTP Method: `PATCH`
- Endpoint: `/jobs/{jobId}/params`

**Parameters**

| Name  | Type                                      | Required | Description                      |
| :---- | :---------------------------------------- | :------- | :------------------------------- |
| body  | [JobAppParams](../models/JobAppParams.md) | ✅       | The request body.                |
| jobId | string                                    | ✅       | The id associated with your job. |

**Return Type**

`JobsJobResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi, JobAppParams } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const jobAppParams: JobAppParams = {
    preset: 'preset',
    partitioner: {},
    assembler: {},
    app: {},
  };

  const { data } = await byteNiteJobsApi.jobs.customerSetJobParams('jobId', jobAppParams);

  console.log(data);
})();
```

## customerGetJobResults

Get job results

- HTTP Method: `GET`
- Endpoint: `/jobs/{jobId}/results`

**Parameters**

| Name  | Type   | Required | Description                      |
| :---- | :----- | :------- | :------------------------------- |
| jobId | string | ✅       | The id associated with your job. |

**Return Type**

`JobsJobResultsResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerGetJobResults('jobId');

  console.log(data);
})();
```

## customerRunJob

Run a job

- HTTP Method: `POST`
- Endpoint: `/jobs/{jobId}/run`

**Parameters**

| Name  | Type                                                                  | Required | Description                      |
| :---- | :-------------------------------------------------------------------- | :------- | :------------------------------- |
| body  | [JobsCustomerRunJobRequest1](../models/JobsCustomerRunJobRequest1.md) | ✅       | The request body.                |
| jobId | string                                                                | ✅       | The id associated with your job. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi, JobJobConfig, JobsCustomerRunJobRequest1 } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const jobJobConfig: JobJobConfig = {
    taskTimeout: 7,
    jobTimeout: 10,
    isTestJob: true,
  };

  const jobsCustomerRunJobRequest1: JobsCustomerRunJobRequest1 = {
    config: jobJobConfig,
  };

  const { data } = await byteNiteJobsApi.jobs.customerRunJob('jobId', jobsCustomerRunJobRequest1);

  console.log(data);
})();
```

## customerSetUploadCompleted

Set a job local file upload completed

- HTTP Method: `PATCH`
- Endpoint: `/jobs/{jobId}/uploadcompleted`

**Parameters**

| Name  | Type   | Required | Description                      |
| :---- | :----- | :------- | :------------------------------- |
| jobId | string | ✅       | The id associated with your job. |

**Return Type**

`CommonGenericResponse`

**Example Usage Code Snippet**

```typescript
import { ByteNiteJobsApi } from 'bytenite jobs api';

(async () => {
  const byteNiteJobsApi = new ByteNiteJobsApi({
    token: 'YOUR_TOKEN',
  });

  const { data } = await byteNiteJobsApi.jobs.customerSetUploadCompleted('jobId');

  console.log(data);
})();
```

<!-- This file was generated by liblab | https://liblab.com/ -->
