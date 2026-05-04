# 🚀 cc-model-manage - Claude Code模型管理器

一个简洁的Node.js CLI工具，用于快速切换Claude Code的大模型。

## 📦 安装

```bash
npm install -g cc-model-manage
```

## 🎯 使用方法

安装完成后，你可以在任何路径下使用以下命令：

### 基本使用
```bash
ccm                    # 使用默认模型（火山方舟）
ccm volces             # 使用火山方舟模型
ccm deepseek           # 使用DeepSeek模型
ccm --list             # 查看所有可用模型
ccm --interactive      # 交互式选择模型
```

### 简写命令
```bash
ccm -l                 # 查看所有模型
ccm -i                 # 交互式选择
ccm --test volces      # 测试模型配置是否有效
ccm --set-default volces  # 设置默认模型
```

## 🔧 配置

安装后会在用户主目录下创建 `.models.json` 配置文件：

**Windows:** `C:\Users\用户名\.models.json`
**macOS/Linux:** `~/.models.json`

### 添加新模型

#### 交互式添加
```bash
ccm --add
```

#### 非交互式添加
```bash
ccm --add-non-interactive \
  --model-id "your-model" \
  --model-description "Your Model" \
  --base-url "https://api.example.com/anthropic" \
  --api-key "your-api-key" \
  --model-name "model-name"
```

### 火山方舟模型配置说明

Claude Code界面显示5个模型选项，对应配置项：

| 配置项 | 说明 |
|--------|------|
| `ANTHROPIC_DEFAULT_HAIKU_MODEL | Haiku选项 |
| `ANTHROPIC_DEFAULT_SONNET_MODEL | Sonnet选项（Default） |
| `ANTHROPIC_DEFAULT_OPUS_MODEL | Opus选项 |
| `ANTHROPIC_MODEL | Custom model选项（带✔） |
| `ANTHROPIC_SMALL_FAST_MODEL | 后台工具调用专用 |

**火山方舟内置别名映射（已配置好）：

```
ark-code-latest → 自动路由
Kimi-K2.6 → 月之暗面
GLM-5.1 → 智谱AI
Doubao-Seed-2.0-pro → 豆包Pro
Doubao-Seed-2.0-Code → 豆包代码专用
```

## 📋 默认模型

| 模型名称 | 描述 |
|----------|------|
| `volces` | 火山方舟（默认） |
| `deepseek` | DeepSeek V4 |

## ✨ 额外工具

### 同步默认模型到bashrc

将默认模型的环境变量永久写入bashrc，直接敲`claude`就能用：

```bash
ccm --update-env volces
source ~/.bashrc
```

## ⚠️ Windows 注意事项

在Windows系统上使用时，请确保：

1. **Git Bash 已安装**：Claude Code 需要 Git Bash 才能在 Windows 上运行
2. **环境变量配置**：如果 Git Bash 不在 PATH 中，请设置：
   ```bash
   set CLAUDE_CODE_GIT_BASH_PATH=C:\Program Files\Git\usr\bin\bash.exe
   ```

## 🔧 常见问题

### API密钥配置
- **问题**：提示需要配置API密钥
- **解决**：编辑 `~/.models.json` 文件，将 `ANTHROPIC_AUTH_TOKEN` 替换为实际的API密钥

### 模型不显示
- **问题**：Claude Code界面只显示部分模型
- **解决**：确保模型名使用火山方舟支持的别名，Claude会校验模型名格式

### Git Bash 路径
- **问题**：找不到 bash.exe
- **解决**：安装 Git for Windows 或设置环境变量

## 🏗️ 开发

```bash
# 克隆项目
git clone [项目地址]
cd cc-model-manage

# 安装依赖
npm install

# 本地测试
npm link

# 取消本地链接
npm unlink -g cc-model-manage
```

## 🚀 发布到npm

```bash
# 登录npm
npm login

# 发布
npm publish --access public
```

## 📄 许可证

MIT
