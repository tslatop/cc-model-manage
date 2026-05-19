#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const program = new Command();

const homeDir = os.homedir();
const configPath = path.join(homeDir, '.models.json');

const defaultConfig = {
  defaultModel: "volces",
  models: {
    volces: {
      description: "火山方舟",
      env: {
        "ANTHROPIC_BASE_URL": "https://ark.cn-beijing.volces.com/api/coding",
        "ANTHROPIC_AUTH_TOKEN": "YOUR_VOLCES_API_KEY_HERE",
        "API_TIMEOUT_MS": "600000",
        "ANTHROPIC_MODEL": "ark-code-latest",
        "ANTHROPIC_SMALL_FAST_MODEL": "Doubao-Seed-2.0-Code",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "Kimi-K2.6",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "GLM-5.1",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "Doubao-Seed-2.0-pro"
      }
    },
    deepseek: {
      description: "DeepSeek V4",
      env: {
        "ANTHROPIC_BASE_URL": "https://api.deepseek.com/anthropic",
        "ANTHROPIC_AUTH_TOKEN": "YOUR_DEEPSEEK_API_KEY_HERE",
        "API_TIMEOUT_MS": "600000",
        "ANTHROPIC_MODEL": "deepseek-v4-pro[1m]",
        "ANTHROPIC_SMALL_FAST_MODEL": "deepseek-v4-flash",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro[1m]",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro[1m]",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
        "CLAUDE_CODE_SUBAGENT_MODEL": "deepseek-v4-flash",
        "CLAUDE_CODE_EFFORT_LEVEL": "max"
      }
    }
  }
};

function initConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(chalk.green(`✅ 已创建配置文件: ${configPath}`));
  }
}

function readConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (config.defaultModel === undefined) {
      config.defaultModel = 'kimi';
    }
    return config;
  } catch (error) {
    console.error(chalk.red(`❌ 读取配置文件失败: ${error.message}`));
    process.exit(1);
  }
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(chalk.red(`❌ 保存配置文件失败: ${error.message}`));
    process.exit(1);
  }
}

function listModels() {
  const config = readConfig();
  console.log(chalk.cyan('\n📋 可用模型:'));

  Object.entries(config.models).forEach(([name, model]) => {
    if (name === config.defaultModel) {
      console.log(`  ${chalk.green(name)} - ${model.description} ${chalk.yellow('[默认]')}`);
    } else {
      console.log(`  ${chalk.green(name)} - ${model.description}`);
    }
  });
  console.log();
}

function checkApiKeys(config, modelName = null) {
  let hasPlaceholder = false;

  if (modelName) {
    const model = config.models[modelName];
    if (model && (model.env.ANTHROPIC_AUTH_TOKEN.includes('YOUR_') || model.env.ANTHROPIC_AUTH_TOKEN === 'placeholder')) {
      console.log(chalk.yellow(`⚠️  模型 ${modelName} 需要配置API密钥`));
      hasPlaceholder = true;
    }
  } else {
    Object.entries(config.models).forEach(([name, model]) => {
      if (model.env.ANTHROPIC_AUTH_TOKEN.includes('YOUR_') || model.env.ANTHROPIC_AUTH_TOKEN === 'placeholder') {
        console.log(chalk.yellow(`⚠️  模型 ${name} 需要配置API密钥`));
        hasPlaceholder = true;
      }
    });
  }

  if (hasPlaceholder) {
    console.log(chalk.cyan(`\n💡 请编辑配置文件添加API密钥: ${configPath}`));
    console.log(chalk.gray('将 ANTHROPIC_AUTH_TOKEN 的值替换为你的实际API密钥'));
  }

  return hasPlaceholder;
}

function switchModel(modelName) {
  const config = readConfig();

  if (!config.models[modelName]) {
    console.log(chalk.red(`❌ 模型 "${modelName}" 不存在`));
    listModels();
    process.exit(1);
  }

  const model = config.models[modelName];

  if (checkApiKeys(config, modelName)) {
    process.exit(1);
  }

  console.log(chalk.cyan(`🔄 正在切换到模型: ${chalk.green(modelName)}`));

  const env = { ...process.env };
  Object.entries(model.env).forEach(([key, value]) => {
    env[key] = value;
  });

  console.log(chalk.green(`✅ 已切换到 ${modelName}，正在启动 Claude Code...`));

  const workDir = process.cwd();
  console.log(chalk.cyan(`📁 工作目录: ${workDir}`));

  const platform = process.platform;
  let claude;

  if (platform === 'win32') {
    const normalizedPath = path.resolve(workDir);
    console.log(chalk.gray(`规范化路径: ${normalizedPath}`));
    console.log(chalk.blue(`🚀 正在启动 Claude Code (工作目录: ${normalizedPath})`));

    claude = spawn('npx', ['claude'], {
      stdio: 'inherit',
      env: env,
      shell: true,
      cwd: normalizedPath
    });
  } else {
    claude = spawn('claude', [], {
      stdio: 'inherit',
      env: env,
      shell: true,
      cwd: workDir
    });
  }

  claude.on('error', (error) => {
    if (error.code === 'ENOENT') {
      console.error(chalk.red('❌ Claude Code 未安装或未添加到PATH'));
      console.log(chalk.yellow('请确保已安装 Claude Code'));
    } else {
      console.error(chalk.red(`❌ 启动Claude Code失败: ${error.message}`));
    }
    process.exit(1);
  });
}

async function addModel() {
  console.log(chalk.cyan('🚀 开始添加新模型'));
  console.log(chalk.yellow('💡 请准备好模型的相关信息'));

  const config = readConfig();

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'modelId',
      message: '请输入模型ID (如: mymodel):',
      validate: (input) => {
        if (!input) return '模型ID不能为空';
        if (config.models[input]) return '此模型ID已存在';
        if (input.includes(' ')) return '模型ID不能包含空格';
        return true;
      }
    },
    {
      type: 'input',
      name: 'description',
      message: '请输入模型描述 (如: My Custom Model):',
      validate: (input) => input ? true : '模型描述不能为空'
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: '请输入模型API Base URL:',
      validate: (input) => input ? true : 'API Base URL不能为空'
    },
    {
      type: 'input',
      name: 'apiKey',
      message: '请输入API Key:',
      validate: (input) => input ? true : 'API Key不能为空'
    },
    {
      type: 'input',
      name: 'modelName',
      message: '请输入默认模型名称 (如: my-model-v1):',
      validate: (input) => input ? true : '模型名称不能为空'
    },
    {
      type: 'input',
      name: 'smallFastModel',
      message: '请输入轻量模型名称 (默认与主模型相同):',
    },
    {
      type: 'input',
      name: 'timeout',
      message: '请输入API超时时间 (毫秒, 默认600000):',
      default: '600000',
      validate: (input) => /^\d+$/.test(input) ? true : '超时时间必须是数字'
    }
  ]);

  const newModel = {
    description: answers.description,
    env: {
      ANTHROPIC_BASE_URL: answers.baseUrl,
      ANTHROPIC_AUTH_TOKEN: answers.apiKey,
      API_TIMEOUT_MS: answers.timeout,
      ANTHROPIC_MODEL: answers.modelName,
      ANTHROPIC_SMALL_FAST_MODEL: answers.smallFastModel || answers.modelName,
      ANTHROPIC_DEFAULT_SONNET_MODEL: answers.modelName,
      ANTHROPIC_DEFAULT_OPUS_MODEL: answers.modelName,
      ANTHROPIC_DEFAULT_HAIKU_MODEL: answers.modelName
    }
  };

  config.models[answers.modelId] = newModel;
  saveConfig(config);

  console.log(chalk.green('✅ 新模型添加成功!'));
  console.log(chalk.cyan(`\n📋 新模型信息:`));
  console.log(chalk.green(`   模型ID: ${answers.modelId}`));
  console.log(chalk.green(`   描述: ${answers.description}`));
  console.log(chalk.green(`   API URL: ${answers.baseUrl}`));
  console.log(chalk.green(`   默认模型: ${answers.modelName}`));
}

async function removeModel(modelId) {
  const config = readConfig();

  if (!config.models[modelId]) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  if (config.defaultModel === modelId) {
    console.error(chalk.red(`❌ 不能删除默认模型 ${modelId}`));
    console.log(chalk.yellow(`💡 请先使用 "ccm default <模型ID>" 设置新的默认模型`));
    process.exit(1);
  }

  const answer = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'confirm',
      message: `确定要删除模型 ${modelId} 吗？`,
      default: false
    }
  ]);

  if (!answer.confirm) {
    console.log(chalk.cyan('ℹ️  已取消删除操作'));
    process.exit(0);
  }

  delete config.models[modelId];
  saveConfig(config);

  console.log(chalk.green(`✅ 模型 ${modelId} 已成功删除`));
}

async function setDefaultModel(modelId) {
  const config = readConfig();

  if (!config.models[modelId]) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  config.defaultModel = modelId;
  saveConfig(config);

  console.log(chalk.green(`✅ 默认模型已成功设置为 ${modelId}`));
}

async function editModel(modelId) {
  const config = readConfig();
  const existingModel = config.models[modelId];

  if (!existingModel) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  const currentEnv = existingModel.env;

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'description',
      message: '请输入模型描述:',
      default: existingModel.description
    },
    {
      type: 'input',
      name: 'baseUrl',
      message: '请输入模型API Base URL:',
      default: currentEnv.ANTHROPIC_BASE_URL
    },
    {
      type: 'input',
      name: 'apiKey',
      message: '请输入API Key:',
      default: currentEnv.ANTHROPIC_AUTH_TOKEN
    },
    {
      type: 'input',
      name: 'modelName',
      message: '请输入默认模型名称:',
      default: currentEnv.ANTHROPIC_MODEL
    },
    {
      type: 'input',
      name: 'smallFastModel',
      message: '请输入轻量模型名称:',
      default: currentEnv.ANTHROPIC_SMALL_FAST_MODEL
    },
    {
      type: 'input',
      name: 'timeout',
      message: '请输入API超时时间 (毫秒):',
      default: currentEnv.API_TIMEOUT_MS,
      validate: (input) => /^\d+$/.test(input) ? true : '超时时间必须是数字'
    }
  ]);

  existingModel.description = answers.description;
  existingModel.env = {
    ANTHROPIC_BASE_URL: answers.baseUrl,
    ANTHROPIC_AUTH_TOKEN: answers.apiKey,
    API_TIMEOUT_MS: answers.timeout,
    ANTHROPIC_MODEL: answers.modelName,
    ANTHROPIC_SMALL_FAST_MODEL: answers.smallFastModel,
    ANTHROPIC_DEFAULT_SONNET_MODEL: answers.modelName,
    ANTHROPIC_DEFAULT_OPUS_MODEL: answers.modelName,
    ANTHROPIC_DEFAULT_HAIKU_MODEL: answers.modelName
  };

  saveConfig(config);

  console.log(chalk.green(`✅ 模型 ${modelId} 已成功更新`));
}

async function testModel(modelId) {
  const config = readConfig();
  const model = config.models[modelId];

  if (!model) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  const axios = require('axios');

  console.log(chalk.cyan(`🔍 正在测试模型 ${modelId} 的配置...`));
  console.log(chalk.gray(`API地址: ${model.env.ANTHROPIC_BASE_URL}`));
  console.log(chalk.gray(`模型名称: ${model.env.ANTHROPIC_MODEL}`));
  console.log(chalk.gray(`超时时间: ${model.env.API_TIMEOUT_MS}ms`));

  try {
    const response = await axios({
      method: 'POST',
      url: `${model.env.ANTHROPIC_BASE_URL}/v1/messages`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.env.ANTHROPIC_AUTH_TOKEN}`
      },
      data: {
        model: model.env.ANTHROPIC_MODEL,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10
      },
      timeout: parseInt(model.env.API_TIMEOUT_MS)
    });

    if (response.status === 200 && response.data) {
      console.log(chalk.green(`✅ 模型 ${modelId} 配置有效，API响应正常`));

      try {
        let responseText;

        if (response.data.content) {
          if (Array.isArray(response.data.content) && response.data.content[0]?.text) {
            responseText = response.data.content[0].text.trim();
          } else if (typeof response.data.content === 'string') {
            responseText = response.data.content.trim();
          } else {
            responseText = JSON.stringify(response.data.content, null, 2);
          }
        } else if (response.data.choices && Array.isArray(response.data.choices)) {
          const choice = response.data.choices[0];
          responseText = choice?.message?.content?.trim() || choice?.content?.trim() || JSON.stringify(choice, null, 2);
        } else {
          responseText = JSON.stringify(response.data, null, 2);
        }

        console.log(chalk.yellow(`💡 测试响应: ${responseText}`));
      } catch (error) {
        console.log(chalk.yellow(`💡 测试响应: ${JSON.stringify(response.data, null, 2)}`));
      }
    } else {
      console.error(chalk.red(`❌ 模型 ${modelId} 配置无效，API响应异常`));
    }
  } catch (error) {
    console.error(chalk.red(`❌ 测试失败: ${error.message}`));
    if (error.response) {
      console.error(chalk.gray(`错误状态码: ${error.response.status}`));
      if (error.response.data) {
        console.error(chalk.gray(`错误信息: ${JSON.stringify(error.response.data)}`));
      }
    }
    process.exit(1);
  }
}

async function updateEnv(modelId) {
  const config = readConfig();
  const model = config.models[modelId];

  if (!model) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  const bashrcPath = path.join(os.homedir(), '.bashrc');

  console.log(chalk.cyan(`🔧 正在将 ${modelId} 的环境变量写入 ~/.bashrc...`));

  let bashrc = fs.readFileSync(bashrcPath, 'utf8');

  const startMarker = '# cc-model-switcher - 模型切换器环境变量配置';
  const endMarker = '# 结束 cc-model-switcher 配置';
  const startIdx = bashrc.indexOf(startMarker);
  const endIdx = bashrc.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    bashrc = bashrc.substring(0, startIdx) + bashrc.substring(endIdx + endMarker.length + 1);
  }

  let envLines = `
${startMarker}
# 默认模型: ${modelId} (${model.description})
`;

  for (const [key, value] of Object.entries(model.env)) {
    envLines += `export ${key}="${value}"
`;
  }

  envLines += `${endMarker}
`;

  bashrc += envLines;
  fs.writeFileSync(bashrcPath, bashrc);

  console.log(chalk.green(`✅ 已更新bashrc环境变量，默认模型: ${modelId} (${model.description})`));
  console.log(chalk.gray('💡 请执行 source ~/.bashrc 使配置生效'));
}

async function interactiveSelect() {
  const config = readConfig();
  const models = Object.entries(config.models).map(([name, model]) => ({
    name: `${name} - ${model.description}`,
    value: name
  }));

  const answer = await inquirer.prompt([
    {
      type: 'list',
      name: 'model',
      message: '选择要使用的模型:',
      choices: models
    }
  ]);

  switchModel(answer.model);
}

// ========== CLI 定义 ==========

program
  .name('ccm')
  .description('Claude Code 模型切换器')
  .version(require('../package.json').version);

program
  .command('list')
  .aliases(['ls'])
  .description('列出所有可用模型')
  .action(() => {
    initConfig();
    listModels();
  });

program
  .command('switch <model>')
  .aliases(['use', 's'])
  .description('切换到指定模型并启动 Claude Code')
  .action((model) => {
    initConfig();
    switchModel(model);
  });

program
  .command('add')
  .description('添加新模型')
  .option('--model-id <id>', '模型ID')
  .option('--description <desc>', '模型描述')
  .option('--base-url <url>', 'API Base URL')
  .option('--api-key <key>', 'API Key')
  .option('--model-name <name>', '模型名称')
  .option('--small-fast-model <name>', '轻量模型名称')
  .option('--timeout <ms>', 'API超时时间（毫秒）')
  .action(async (options) => {
    initConfig();
    // 如果有任何非交互参数则走无交互模式，否则交互式
    const isNonInteractive = options.modelId || options.description || options.baseUrl || options.apiKey || options.modelName || options.smallFastModel || options.timeout;
    if (isNonInteractive) {
      const missing = [];
      if (!options.modelId) missing.push('--model-id');
      if (!options.description) missing.push('--description');
      if (!options.baseUrl) missing.push('--base-url');
      if (!options.apiKey) missing.push('--api-key');
      if (!options.modelName) missing.push('--model-name');
      if (missing.length > 0) {
        console.error(chalk.red(`❌ 缺少必填参数: ${missing.join(', ')}`));
        process.exit(1);
      }

      const config = readConfig();

      if (config.models[options.modelId]) {
        console.error(chalk.red(`❌ 模型ID ${options.modelId} 已存在`));
        process.exit(1);
      }
      if (options.modelId.includes(' ')) {
        console.error(chalk.red(`❌ 模型ID不能包含空格`));
        process.exit(1);
      }
      if (options.timeout && !/^\d+$/.test(options.timeout)) {
        console.error(chalk.red(`❌ 超时时间必须是数字`));
        process.exit(1);
      }

      const newModel = {
        description: options.description,
        env: {
          ANTHROPIC_BASE_URL: options.baseUrl,
          ANTHROPIC_AUTH_TOKEN: options.apiKey,
          API_TIMEOUT_MS: options.timeout || '600000',
          ANTHROPIC_MODEL: options.modelName,
          ANTHROPIC_SMALL_FAST_MODEL: options.smallFastModel || options.modelName,
          ANTHROPIC_DEFAULT_SONNET_MODEL: options.modelName,
          ANTHROPIC_DEFAULT_OPUS_MODEL: options.modelName,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: options.modelName
        }
      };

      config.models[options.modelId] = newModel;
      saveConfig(config);

      console.log(chalk.green('✅ 新模型添加成功!'));
      console.log(chalk.cyan(`\n📋 新模型信息:`));
      console.log(chalk.green(`   模型ID: ${options.modelId}`));
      console.log(chalk.green(`   描述: ${options.description}`));
      console.log(chalk.green(`   API URL: ${options.baseUrl}`));
      console.log(chalk.green(`   默认模型: ${options.modelName}`));
    } else {
      await addModel();
    }
  });

program
  .command('remove <model>')
  .aliases(['rm'])
  .description('删除指定模型')
  .action(async (model) => {
    initConfig();
    await removeModel(model);
  });

program
  .command('default <model>')
  .aliases(['set-default'])
  .description('设置默认模型')
  .action(async (model) => {
    initConfig();
    await setDefaultModel(model);
  });

program
  .command('edit <model>')
  .description('编辑指定模型的配置')
  .action(async (model) => {
    initConfig();
    await editModel(model);
  });

program
  .command('test <model>')
  .description('测试模型的 API 配置有效性')
  .action(async (model) => {
    initConfig();
    await testModel(model);
  });

program
  .command('env <model>')
  .description('将模型环境变量写入 ~/.bashrc（永久生效）')
  .action(async (model) => {
    initConfig();
    await updateEnv(model);
  });

program
  .command('interactive')
  .aliases(['i', 'select'])
  .description('交互式选择模型')
  .action(async () => {
    initConfig();
    await interactiveSelect();
  });

// 顶层参数：不匹配子命令时，将参数当作模型名直接切换
program
  .arguments('[model]')
  .action((model) => {
    initConfig();
    if (model) {
      switchModel(model);
    } else {
      const config = readConfig();
      switchModel(config.defaultModel);
    }
  });

program.parse();
