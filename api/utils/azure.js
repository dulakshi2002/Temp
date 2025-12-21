// api/utils/azure.js
import { BlobServiceClient, generateBlobSASQueryParameters, ContainerSASPermissions, SASProtocol, StorageSharedKeyCredential } from "@azure/storage-blob";
import dotenv from "dotenv";
dotenv.config();

const CONN = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER = process.env.AZURE_BLOB_CONTAINER || "syllabus";
const TTL_MIN = parseInt(process.env.AZURE_BLOB_SAS_TTL_MIN || "30", 10);

export function getContainerClient() {
  const svc = BlobServiceClient.fromConnectionString(CONN);
  return svc.getContainerClient(CONTAINER);
}

// Mint a write SAS for a *new* blob name so FE can PUT/POST directly to Azure.
export async function getWriteSAS(blobName) {
  const accountName = /AccountName=([^;]+)/.exec(CONN)[1];
  const accountKey  = /AccountKey=([^;]+)/.exec(CONN)[1];
  const creds = new StorageSharedKeyCredential(accountName, accountKey);

  const now = new Date();
  const expiresOn = new Date(now.getTime() + TTL_MIN*60*1000);

  const sas = generateBlobSASQueryParameters(
    {
      containerName: CONTAINER,
      blobName,
      permissions: ContainerSASPermissions.parse("cw"), // create + write
      startsOn: new Date(now.getTime() - 2 * 60 * 1000),
      expiresOn,
      protocol: SASProtocol.HttpsAndHttp,
    },
    creds
  ).toString();

  const url = `https://${accountName}.blob.core.windows.net/${CONTAINER}/${encodeURIComponent(blobName)}?${sas}`;
  return { url, expiresOn };
}
