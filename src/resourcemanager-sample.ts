import * as dotenv from "dotenv";

import { BatchManagementClient } from "@azure/arm-batch";
import { DefaultAzureCredential } from "@azure/identity";
import { Pool } from "@azure/arm-batch/esm/models";

dotenv.config();

const accountName = process.env["AZURE_BATCH_ACCOUNT"] || "";
const subscriptionId = process.env["SUBSCRIPTION_ID"] || "";
const resourceGroup = process.env["RESOURCE_GROUP"] || "";

const poolName = "arm-pool-" + Math.random().toString(16).substr(2, 8);

const POOL_INTERVAL = 8000;

console.log(`
    Account ${accountName}
    ResourceGroup ${resourceGroup}
`);

async function run() {
    const creds = new DefaultAzureCredential();
    const client = new BatchManagementClient(creds, subscriptionId);
    
    const pools = await client.pool.listByBatchAccount(resourceGroup, accountName);

    const acc = await client.batchAccount.get(resourceGroup, accountName);
    console.log(`ACCOUNT ${acc.name} ${acc.location}`);

    console.log("POOLS");
    pools.forEach(pool => printPool(pool));

    console.log(`\nCreating pool ${poolName}...`);
    const pool = await client.pool.create(
        resourceGroup,
        accountName,
        poolName,
        {
            vmSize: "STANDARD_A1_V2",
            deploymentConfiguration: {
                virtualMachineConfiguration: {
                    imageReference: {
                        publisher: "Canonical",
                        offer: "UbuntuServer",
                        sku: "18.04-LTS",
                        version: "latest",
                    },
                    nodeAgentSkuId: "batch.node.ubuntu 18.04",
                },
            },
        },
        {
            targetDedicatedNodes: 1,
            targetLowPriorityNodes: 2
        }
    );

    printPool(pool);

    const steady = new Promise(resolve => {
        const timeout = setInterval(async () => {
            const pool = await client.pool.get(
                resourceGroup, accountName, poolName
            );
            printPool(pool);
            if (pool.allocationState === "Steady") {
                resolve(true);
                clearTimeout(timeout);
            }
        }, POOL_INTERVAL);
    });

    steady.then(async () => {
        setTimeout(async () => {
            const pool = await client.pool.get(
                resourceGroup, accountName, poolName
            );
            printPool(pool);

            console.log(`\nDeleting pool ${poolName}...`);
            await client.pool.deleteMethod(
                resourceGroup,
                accountName,
                poolName
            );
            console.log("Deleted");
        }, 10000);
    });
}

function printPool(pool: Pool) {
    console.log(`${pool.name} ${pool.vmSize} ${pool.allocationState} [${pool.currentDedicatedNodes} : ${pool.currentLowPriorityNodes}]`);
}


(async () => run())();
