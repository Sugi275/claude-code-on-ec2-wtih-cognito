const { Authenticator } = require("cognito-at-edge");
const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");

const SSM_PREFIX = "{{SSM_PREFIX}}";

let authenticator;

async function getAuthenticator() {
  if (authenticator) return authenticator;

  const ssm = new SSMClient({ region: "ap-northeast-1" });
  const get = (Name) =>
    ssm.send(new GetParameterCommand({ Name })).then((r) => r.Parameter.Value);

  const [userPoolId, clientId, domain] = await Promise.all([
    get(`${SSM_PREFIX}/userPoolId`),
    get(`${SSM_PREFIX}/clientId`),
    get(`${SSM_PREFIX}/domain`),
  ]);

  authenticator = new Authenticator({
    region: "ap-northeast-1",
    userPoolId,
    userPoolAppId: clientId,
    userPoolDomain: domain,
    cookieExpirationDays: 7,
  });

  return authenticator;
}

exports.handler = async (request) => {
  const cfRequest = request.Records[0].cf.request;
  const headers = cfRequest.headers;

  // Skip auth for WebSocket upgrade requests
  const upgrade = headers["upgrade"];
  if (upgrade && upgrade[0].value.toLowerCase() === "websocket") {
    return cfRequest;
  }

  // Skip auth for code-server static assets (webview iframes lack cookies)
  const uri = cfRequest.uri;
  if (uri.includes("/static/") || uri.startsWith("/_static/")) {
    return cfRequest;
  }

  const auth = await getAuthenticator();
  return auth.handle(request);
};
