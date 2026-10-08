export interface CredentialVaultEntry {
  id: string;
  name: string;
  createdAt: string;
}

export interface CreateCredentialVaultEntryRequest {
  name: string;
  password: string;
}
