#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const program = new Command();

// 获取用户主目录
const homeDir = require('os').homedir();
const configPath = path.join(homeDir, '.models.json');

// 默认配置 - 使用占位符
const defaultConfig = {
  defaultModel: "volces", // 默认火山方舟
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
        "ANTHROPIC_MODEL": "deepseek-v4-flash",
        "ANTHROPIC_SMALL_FAST_MODEL": "deepseek-v4-flash",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-pro",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash"
      }
    }
  }
};



/**
 * 初始化配置文件
 * @date 2025-01-14
 */
function initConfig() {
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(chalk.green(`✅ 已创建配置文件: ${configPath}`));
  }
  // 不再自动添加或更新模型，用户需通过 --add 手动添加
}


// 读取配置
function readConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    // 确保配置有默认模型字段，保持向后兼容性
    if (config.defaultModel === undefined) {
      config.defaultModel = 'kimi'; // 默认使用kimi
    }
    return config;
  } catch (error) {
    console.error(chalk.red(`❌ 读取配置文件失败: ${error.message}`));
    process.exit(1);
  }
}

// 保存配置
function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(chalk.red(`❌ 保存配置文件失败: ${error.message}`));
    process.exit(1);
  }
}

// 列出所有模型
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

/**
 * 检查并提示API密钥
 * @param {Object} config - 配置对象
 * @param {string} modelName - 要检查的模型名称，如果不提供则检查所有模型
 * @returns {boolean} 是否有占位符密钥
 * @date 2025-01-14
 */
function checkApiKeys(config, modelName = null) {
  let hasPlaceholder = false;
  
  if (modelName) {
    // 只检查指定模型
    const model = config.models[modelName];
    if (model && (model.env.ANTHROPIC_AUTH_TOKEN.includes('YOUR_') || model.env.ANTHROPIC_AUTH_TOKEN === 'placeholder')) {
      console.log(chalk.yellow(`⚠️  模型 ${modelName} 需要配置API密钥`));
      hasPlaceholder = true;
    }
  } else {
    // 检查所有模型
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


/**
 * 切换模型并启动Claude Code
 * @param {string} modelName - 模型名称
 * @date 2025-01-14
 */
function switchModel(modelName) {
  const config = readConfig();
  
  if (!config.models[modelName]) {
    console.log(chalk.red(`❌ 模型 "${modelName}" 不存在`));
    listModels();
    process.exit(1);
  }

  const model = config.models[modelName];
  
  // 检查当前模型的API密钥
  if (checkApiKeys(config, modelName)) {
    process.exit(1);
  }

  console.log(chalk.cyan(`🔄 正在切换到模型: ${chalk.green(modelName)}`));
  
  // 设置环境变量并启动Claude Code
  const env = { ...process.env };
  Object.entries(model.env).forEach(([key, value]) => {
    env[key] = value;
  });

  console.log(chalk.green(`✅ 已切换到 ${modelName}，正在启动 Claude Code...`));
  
  // 启动Claude Code - 正确处理Windows环境
  const workDir = process.cwd();
  console.log(chalk.cyan(`📁 工作目录: ${workDir}`));
  
  const platform = process.platform;
  let claude;
  
  if (platform === 'win32') {
    // Windows: 直接使用cwd参数设置工作目录
    const normalizedPath = path.resolve(workDir);
    console.log(chalk.gray(`规范化路径: ${normalizedPath}`));
    
    // 修复日期: 2025-01-14
    // 修复内容: 使用spawn的cwd参数直接设置工作目录，避免PowerShell路径处理问题
    console.log(chalk.blue(`🚀 正在启动 Claude Code (工作目录: ${normalizedPath})`));
    
    claude = spawn('npx', ['claude'], {
      stdio: 'inherit',
      env: env,
      shell: true,
      cwd: normalizedPath
    });
  } else {
    // macOS/Linux: 正常启动
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
      console.log(chalk.yellow('Windows用户请确保:'));
      console.log(chalk.yellow('1. 已安装Claude Code'));
      console.log(chalk.yellow('2. 已安装Git Bash'));
      console.log(chalk.yellow('3. 已将claude命令添加到系统PATH'));
      console.log(chalk.yellow('4. 或设置环境变量 CLAUDE_CODE_GIT_BASH_PATH'));
    } else {
      console.error(chalk.red(`❌ 启动Claude Code失败: ${error.message}`));
    }
    process.exit(1);
  });
}

/**
 * 添加新模型
 * @date 2025-01-14
 */
async function addModel() {
  console.log(chalk.cyan('🚀 开始添加新模型'));
  console.log(chalk.yellow('💡 请准备好模型的相关信息'));

  const config = readConfig();

  // 交互式收集模型信息
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

  // 构建新模型配置
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

  // 添加到配置
  config.models[answers.modelId] = newModel;
  saveConfig(config);

  console.log(chalk.green('✅ 新模型添加成功!'));
  console.log(chalk.cyan(`\n📋 新模型信息:`));
  console.log(chalk.green(`   模型ID: ${answers.modelId}`));
  console.log(chalk.green(`   描述: ${answers.description}`));
  console.log(chalk.green(`   API URL: ${answers.baseUrl}`));
  console.log(chalk.green(`   默认模型: ${answers.modelName}`));
  console.log(chalk.yellow(`\n💡 您可以使用以下命令切换到新模型:`));
  console.log(chalk.white(`   cc_switch ${answers.modelId}`));
  console.log(chalk.white(`   或使用交互式选择: cc_switch -i`));
}

/**
 * 非交互式添加新模型
 * @param {Object} options - 命令行选项
 * @date 2025-01-14
 */
async function addModelNonInteractive(options) {
  const config = readConfig();

  // 验证必填参数
  const requiredParams = ['modelId', 'modelDescription', 'baseUrl', 'apiKey', 'modelName'];
  const missingParams = requiredParams.filter(param => !options[param]);

  if (missingParams.length > 0) {
    console.error(chalk.red(`❌ 缺少必填参数: ${missingParams.join(', ')}`));
    // 将驼峰式参数名转换为短横线分隔的参数名
    const formattedParam = missingParams[0].replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
    console.log(chalk.yellow(`💡 请使用 --${formattedParam} 参数`));
    console.log(chalk.yellow(`   使用 --help 查看所有非交互式参数`));
    process.exit(1);
  }

  // 验证模型ID是否已存在
  if (config.models[options.modelId]) {
    console.error(chalk.red(`❌ 模型ID ${options.modelId} 已存在`));
    process.exit(1);
  }

  // 验证模型ID格式
  if (options.modelId.includes(' ')) {
    console.error(chalk.red(`❌ 模型ID不能包含空格`));
    process.exit(1);
  }

  // 验证超时时间格式
  if (options.timeout && !/^\d+$/.test(options.timeout)) {
    console.error(chalk.red(`❌ 超时时间必须是数字`));
    process.exit(1);
  }

  // 构建新模型配置
  const newModel = {
    description: options.modelDescription,
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

  // 添加到配置
  config.models[options.modelId] = newModel;
  saveConfig(config);

  console.log(chalk.green('✅ 新模型添加成功!'));
  console.log(chalk.cyan(`\n📋 新模型信息:`));
  console.log(chalk.green(`   模型ID: ${options.modelId}`));
  console.log(chalk.green(`   描述: ${options.modelDescription}`));
  console.log(chalk.green(`   API URL: ${options.baseUrl}`));
  console.log(chalk.green(`   默认模型: ${options.modelName}`));
  console.log(chalk.yellow(`\n💡 您可以使用以下命令切换到新模型:`));
  console.log(chalk.white(`   cc_switch ${options.modelId}`));
}

/**
 * 删除指定模型
 * @param {string} modelId - 要删除的模型ID
 * @date 2025-01-14
 */
async function removeModel(modelId) {
  const config = readConfig();

  // 验证模型是否存在
  if (!config.models[modelId]) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  // 不能删除默认模型
  if (config.defaultModel === modelId) {
    console.error(chalk.red(`❌ 不能删除默认模型 ${modelId}`));
    console.log(chalk.yellow(`💡 请先使用 --set-default 设置新的默认模型`));
    process.exit(1);
  }

  // 交互式确认
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

  // 删除模型
  delete config.models[modelId];
  saveConfig(config);

  console.log(chalk.green(`✅ 模型 ${modelId} 已成功删除`));
}

/**
 * 设置默认模型
 * @param {string} modelId - 要设置为默认的模型ID
 * @date 2025-01-14
 */
async function setDefaultModel(modelId) {
  const config = readConfig();

  // 验证模型是否存在
  if (!config.models[modelId]) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  // 更新默认模型
  config.defaultModel = modelId;
  saveConfig(config);

  console.log(chalk.green(`✅ 默认模型已成功设置为 ${modelId}`));
  console.log(chalk.yellow(`💡 现在执行 cc_switch 命令将默认使用 ${modelId}`));
}

/**
 * 编辑指定模型
 * @param {string} modelId - 要编辑的模型ID
 * @date 2025-01-14
 */
async function editModel(modelId) {
  const config = readConfig();
  const existingModel = config.models[modelId];

  // 验证模型是否存在
  if (!existingModel) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  // 获取当前模型配置
  const currentEnv = existingModel.env;

  // 交互式收集更新后的信息
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

  // 更新模型配置
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

  // 保存配置
  saveConfig(config);

  console.log(chalk.green(`✅ 模型 ${modelId} 已成功更新`));
}

/**
 * 测试模型配置有效性
 * @param {string} modelId - 要测试的模型ID
 * @date 2025-01-14
 */
async function testModel(modelId) {
  const config = readConfig();
  const model = config.models[modelId];

  // 验证模型是否存在
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
    // 发送测试请求（使用Anthropic兼容的API格式）
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

    // 检查响应
    if (response.status === 200 && response.data) {
      console.log(chalk.green(`✅ 模型 ${modelId} 配置有效，API响应正常`));

      // 兼容不同API响应格式
      try {
        let responseText;

        // 尝试提取响应内容的多种可能格式
        if (response.data.content) {
          if (Array.isArray(response.data.content) && response.data.content[0]?.text) {
            // Claude/Anthropic格式: content数组包含text字段
            responseText = response.data.content[0].text.trim();
          } else if (typeof response.data.content === 'string') {
            // 简单字符串格式: content直接是文本
            responseText = response.data.content.trim();
          } else {
            // 其他格式: 转换为JSON字符串
            responseText = JSON.stringify(response.data.content, null, 2);
          }
        }
        // OpenAI兼容格式
        else if (response.data.choices && Array.isArray(response.data.choices)) {
          const choice = response.data.choices[0];
          responseText = choice?.message?.content?.trim() || choice?.content?.trim() || JSON.stringify(choice, null, 2);
        }
        // 未知格式
        else {
          responseText = JSON.stringify(response.data, null, 2);
        }

        console.log(chalk.yellow(`💡 测试响应: ${responseText}`));
      } catch (error) {
        // 安全回退：显示完整响应结构
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

/**
 * 交互式选择模型
 * @date 2025-01-14
 */

async function updateEnv(modelId) {
  const config = readConfig();
  const model = config.models[modelId];

  // 验证模型是否存在
  if (!model) {
    console.error(chalk.red(`❌ 模型 ${modelId} 不存在`));
    process.exit(1);
  }

  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const bashrcPath = path.join(os.homedir(), '.bashrc');

  console.log(chalk.cyan(`🔧 正在将 ${modelId} 的环境变量写入 ~/.bashrc...`));

  // 读取现有bashrc
  let bashrc = fs.readFileSync(bashrcPath, 'utf8');

  // 移除旧的cc-model-manage配置
  const startMarker = '# cc-model-switcher - 模型切换器环境变量配置';
  const endMarker = '# 结束 cc-model-switcher 配置';
  const startIdx = bashrc.indexOf(startMarker);
  const endIdx = bashrc.indexOf(endMarker);

  if (startIdx !== -1 && endIdx !== -1) {
    bashrc = bashrc.substring(0, startIdx) + bashrc.substring(endIdx + endMarker.length + 1);
  }

  // 生成新的环境变量配置
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

  // 写入bashrc
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



// 主程序
program
  .name('cc_switch')
  .description('Claude Code 模型切换器')
  .version(require('../package.json').version);

program
  .argument('[model]', '模型名称')
  .option('-l, --list', '列出所有可用模型')
  .option('-i, --interactive', '交互式选择模型')
  .option('--add', '添加新模型（交互式）')
  .option('--add-non-interactive', '添加新模型（非交互式）')
  .option('--model-id <id>', '模型ID（非交互式使用）')
  .option('--model-description <desc>', '模型描述（非交互式使用）')
  .option('--base-url <url>', 'API Base URL（非交互式使用）')
  .option('--api-key <key>', 'API Key（非交互式使用）')
  .option('--model-name <name>', '默认模型名称（非交互式使用）')
  .option('--small-fast-model <name>', '轻量模型名称（非交互式使用）')
  .option('--timeout <ms>', 'API超时时间（非交互式使用）')
  .option('--remove <modelId>', '删除指定模型')
  .option('--set-default <modelId>', '设置默认模型')
  .option('--edit <modelId>', '编辑指定模型')
  .option('--test <modelId>', '测试模型配置有效性')
  .option('--update-env <modelId>', '将模型环境变量写入~/.bashrc（永久生效）')
  .action(async (model, options) => {
    initConfig();

    if (options.add) {
      await addModel();
      return;  // 处理完立即退出
    } else if (options.addNonInteractive) {
      await addModelNonInteractive(options);
      return;  // 处理完立即退出
    } else if (options.remove) {
      await removeModel(options.remove);
      return;  // 处理完立即退出
    } else if (options.setDefault) {
      await setDefaultModel(options.setDefault);
      return;  // 处理完立即退出 - 关键修复
    } else if (options.edit) {
      await editModel(options.edit);
      return;  // 处理完立即退出
    } else if (options.test) {
      await testModel(options.test);
      return;  // 处理完立即退出
    } else if (options.list) {
      listModels();
      return;  // 处理完立即退出
    } else if (options.updateEnv) {
      await updateEnv(options.updateEnv);
      return;  // 处理完立即退出
    } else if (options.interactive) {
      await interactiveSelect();
      return;  // 处理完立即退出
    } else if (model) {
      switchModel(model);
      return;  // 处理完立即退出
    } else {
      // 使用配置文件中的默认模型
      const config = readConfig();
      switchModel(config.defaultModel);
    }
  });

program.parse();