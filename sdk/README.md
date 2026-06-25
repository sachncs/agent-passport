# @agent-passport/sdk

This package's full documentation is at
**[docs/development/sdk-typescript.md](https://github.com/sachn-cs/agent-passport/blob/master/docs/development/sdk-typescript.md)** in the Agent Passport repository.

This README is kept short so the package can be published to npm; the
canonical, version-controlled reference is in the docs/ tree.

## Quickstart

```bash
npm install @agent-passport/sdk
```

```typescript
import { AgentPassportClient } from '@agent-passport/sdk';
const client = new AgentPassportClient({ baseUrl: 'http://localhost:3000' });
const score = await client.getScore('GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX');
console.log(score.trustScore, score.riskLevel);
```

## License

MIT
