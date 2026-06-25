# agent-passport-sdk

This package's full documentation is at
**[docs/development/sdk-python.md](https://github.com/sachn-cs/agent-passport/blob/master/docs/development/sdk-python.md)** in the Agent Passport repository.

This README is kept short so the package can be published to PyPI; the
canonical, version-controlled reference is in the docs/ tree.

## Quickstart

```bash
pip install agent-passport-sdk
```

```python
from agent_passport import AgentPassportClient
client = AgentPassportClient(base_url="http://localhost:3000")
print(client.get_score("GD64YIY3TWGDMCNPP553DZPPR6LDUSFBBHU5AAAAA7XBICTFJ7BY7C55XX"))
```

## License

MIT
