import { BatchServiceClient, BatchServiceModels, BatchSharedKeyCredentials } from "@azure/batch";

import * as dotenv from "dotenv";

dotenv.config();

const batchAccountName = process.env["AZURE_BATCH_ACCOUNT"] || "";
const batchAccountKey = process.env["AZURE_BATCH_ACCESS_KEY"] || "";
const batchEndpoint = process.env["AZURE_BATCH_ENDPOINT"] || "";

const JOB_ID = "testbejob1";
const NUM_TASKS = 50;

console.log(`
    Account ${batchAccountName}
    Key ${batchAccountKey}
    Endpoint ${batchEndpoint}
    `
)

const creds = new BatchSharedKeyCredentials(batchAccountName, batchAccountKey);
const client = new BatchServiceClient(creds, batchEndpoint);

function scenario1() {
    const options: BatchServiceModels.JobListOptionalParams = {
    jobListOptions: { maxResults: 10 }
    };

    async function loop(res: BatchServiceModels.JobListResponse, nextLink?: string): Promise<void> {
    if (nextLink !== undefined) {
        const res1 = await client.job.listNext(nextLink);
        if (res1.length) {
        for (const item of res1) {
            res.push(item);
        }
        }
        return loop(res, res1.odatanextLink);
    }
    return Promise.resolve();
    }

    async function main(): Promise<void> {
    const result = await client.job.list(options);
    await loop(result, result.odatanextLink);
    console.dir(result, { depth: null, colors: true });
    }

    main().catch((err) => console.log("An error occurred: ", err));
}

async function createTasks(jobId:string, taskParams: any[]) {
    console.log(`Creating ${taskParams.length} tasks`);
    const MAX_TASKS_PER_SUB = 100;
    let index = 0;

    let createdTasks: any[] = [];
    do {
        console.log(`Submitting ${index} - ${index+MAX_TASKS_PER_SUB}`);
        const tranch = await client.task.addCollection(
            jobId, taskParams.slice(index, index + MAX_TASKS_PER_SUB));

        for (let task in tranch) {
            createdTasks.push(task);
        }
        index += MAX_TASKS_PER_SUB;
    } while (index + MAX_TASKS_PER_SUB < taskParams.length);
    return createdTasks;
}

function scenario2() {
    async function taskLoop(res: BatchServiceModels.TaskListResponse, nextLink?: string): Promise<void> {
        console.log(`taskLoop: ${res.length}, ${nextLink}`)
        if (nextLink !== undefined) {
            const res1 = await client.task.listNext(nextLink);
            if (res1.length) {
                for (const item of res1) {
                    res.push(item);
                    console.log(item.id);
                }
            }
            if (res1.odatanextLink === nextLink) {
                // The new nextLink is identical to the prevous one instead of pointing to the next page.
                // Therefore the taskLoop function will call itself indefinetly.
                throw new Error("oData.nextLink unchanged. Infinite loop will occur");
            }
    
            return taskLoop(res, res1.odatanextLink);
        }
        return Promise.resolve();
    }
    
    async function getCloudTasks(jobId: string): Promise<Array<BatchServiceModels.CloudTask>> {
        const options: BatchServiceModels.TaskListOptionalParams = { taskListOptions: { maxResults: 4 } };

        let jobAdd = await client.job.get(jobId);
        if (!jobAdd) {
            console.log(`Job ${jobId} does not exist. Creating...`);
            let job = await client.job.add({ id: jobId, poolInfo: { poolId: "pool1"} })
        } else {
            console.log(jobAdd);
        }
        let result: BatchServiceModels.TaskListResponse = await client.task.list(jobId, options);
        console.log(`Task count: ${result.length}`);

        if (result.length < NUM_TASKS) {
            const numTasks = NUM_TASKS - result.length;
            const taskParams: BatchServiceModels.TaskAddParameter[] = [];
            for (let i = 0; i < numTasks; i++) {
                taskParams.push({
                    id: `${jobId}-${i + result.length + 1}`,
                    commandLine: "sleep 100"
                });
            }
            const createdTasks = await createTasks(jobId, taskParams);
            console.log(createdTasks);
            result = await client.task.list(jobId, options);
        }

        console.log("Tasks");
        console.log(result);
        await taskLoop(result, result.odatanextLink);
        return result;
    }

    getCloudTasks(JOB_ID)
        .then((response: Array<BatchServiceModels.CloudTask>) =>
            console.log("Number of tasks:", response.length)
        ).catch((reason: any) => console.error(reason.message))
}

scenario1();
