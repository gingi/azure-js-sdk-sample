import { PublicClientApplication } from "@azure/msal-node";
import * as dotenv from "dotenv";

dotenv.config();

const clientId = process.env.AZURE_CLIENT_ID as string;
const tenantId = process.env.AZURE_TENANT_ID;

const app = new PublicClientApplication({
    auth: {
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`
    }
});

const baseRequest = {
    scopes: [`${tenantId}/user_impersonation`],
    redirectUri: "msal://redirect"
};

app.getAuthCodeUrl(baseRequest)
    .then(url => {
        console.log(`URL [${url}]`);
        return app.acquireTokenByCode({ ...baseRequest, code });
    })
    .then(tokenResponse => console.log("Token", tokenResponse))
    .catch(error => console.error(error));
