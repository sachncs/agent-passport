# agent-passport-sdk

This package's full documentation is in this README and the
[repository API reference](https://github.com/sachncs/agent-passport/blob/master/docs/api.md).

This README is kept short so the package can be published to PyPI; the
canonical, version-controlled reference is in the docs/ tree.

## Quickstart

```bash
pip install agent-passport-sdk
```

```python
from agent_passport import AgentPassportClient
client = AgentPassportClient(base_url="http://localhost:3000")
print(client.get_score("GD64YIY3TWGDMCNPP553DZPPR6LDUSFQOIJVFDPPXWEG3FVOJCCDBBHU5A"))
```

## License

MIT
