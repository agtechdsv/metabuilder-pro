export function parseConnString(type: string, str: string) {
  let user = '', pass = '', host = '', port = '', db = '';
  if (!str) return { user, pass, host, port, db };

  try {
    let withoutProtocol = str;
    const protoIndex = str.indexOf('://');
    if (protoIndex !== -1) {
      withoutProtocol = str.substring(protoIndex + 3);
    }

    const atIndex = withoutProtocol.lastIndexOf('@');
    let authPart = '';
    let hostPathPart = withoutProtocol;
    
    if (atIndex !== -1) {
      authPart = withoutProtocol.substring(0, atIndex);
      hostPathPart = withoutProtocol.substring(atIndex + 1);
      
      const colonAuthIndex = authPart.indexOf(':');
      if (colonAuthIndex !== -1) {
        user = decodeURIComponent(authPart.substring(0, colonAuthIndex));
        pass = decodeURIComponent(authPart.substring(colonAuthIndex + 1));
      } else {
        user = decodeURIComponent(authPart);
      }
    }

    const slashIndex = hostPathPart.indexOf('/');
    let hostPortPart = hostPathPart;
    if (slashIndex !== -1) {
      hostPortPart = hostPathPart.substring(0, slashIndex);
      db = decodeURIComponent(hostPathPart.substring(slashIndex + 1));
    }

    const colonHostIndex = hostPortPart.indexOf(':');
    if (colonHostIndex !== -1) {
      host = hostPortPart.substring(0, colonHostIndex);
      port = hostPortPart.substring(colonHostIndex + 1);
    } else {
      host = hostPortPart;
    }
  } catch (e) {
    console.error("Error parsing conn string", e);
  }

  return { user, pass, host, port, db };
}

export function buildConnString(type: string, parsed: {user: string, pass: string, host: string, port: string, db: string}) {
  const protocol = type === 'postgres' ? 'postgresql' : type || 'postgresql';
  const u = encodeURIComponent(parsed.user);
  const p = encodeURIComponent(parsed.pass);
  const auth = (u || p) ? `${u}:${p}@` : '';
  const port = parsed.port ? `:${parsed.port}` : '';
  const db = parsed.db ? `/${encodeURIComponent(parsed.db)}` : '';
  return `${protocol}://${auth}${parsed.host}${port}${db}`;
}

export const defaultTunnelConfigTemplate = `{
  "connections": [
    {
      "projectId": "",
      "secretToken": "",
      "connectionsString": [
        {
          "name": "public",
          "type": "postgres",
          "connectionString": "postgresql://postgres:password@localhost:5432/dbname"
        }
      ]
    }
  ],
  "ldap": {
    "enabled": false,
    "url": "ldap://10.0.0.15:389",
    "baseDn": "dc=empresa,dc=local",
    "bindDn": "cn=metabuilder_service,ou=Services,dc=empresa,dc=local",
    "bindPassword": "senha_secreta_do_bind",
    "searchFilter": "(sAMAccountName={{username}})"
  },
  "downloadPath": "C:\\\\AgTech\\\\DownloadsMetaBuilder"
}`
