# 最小版本架构分析

去掉所有额外代码，只剩余7000行代码。分布在11个模块上。代码较多的是agent和providers。其他都很少。而且观察业务流程和模块的话，rust代码很清晰。

## 主要模块
- main：只保留 zeroclaw agent 命令，负责解析 CLI 参数并加载配置。
- config：负责创建/读取 config.toml 和 workspace 目录，最关键字段是 api_key、api_url、default_model、default_temperature。
- agent：系统核心，负责装配 provider、tools、security、runtime、memory、observer，并驱动对话循环。
- providers：只剩一个 openai-compatible provider，统一对接 OpenAI 风格接口。
- tools：只保留 4 个工具：shell、file_read、file_write、file_edit。
- security：负责工作区边界、命令白名单、危险路径拦截、动作频率限制。
- runtime：只剩 native，本地直接执行 shell 命令。
- memory：只剩 none，是空实现，不做持久记忆。
- observability：只剩 noop，接口还在，但默认不输出额外观测。
- dispatcher：负责把模型输出解析成工具调用，再把工具结果重新包装回模型上下文。
- prompt：负责生成 system prompt，注入工具说明、安全约束、工作区路径、时间和运行时信息。


下面这套图是按当前“最小化版本”的真实代码画的，主入口在 src/main.rs，装配核心在 src/agent/agent.rs，最小工具集在 src/tools/mod.rs。
架构图

```mermaid
flowchart LR
    U[User / CLI] --> M[src/main.rs]
    M --> C[config::Config\n加载/初始化 config.toml]
    M --> A[agent::run]

    C --> AC[agent config]
    C --> AU[autonomy/security config]
    C --> PC[provider config\napi_key api_url model]
    C --> RC[runtime config]
    C --> OC[observability config]
    C --> MC[memory config]

    A --> AF[Agent::from_config]

    AF --> P[providers::create_provider\nOpenAI-compatible only]
    AF --> T[tools::default_tools_with_runtime]
    AF --> R[runtime::create_runtime\nnative only]
    AF --> O[observability::create_observer\nnoop only]
    AF --> MEM[memory::create_memory\nnone only]
    AF --> S[SecurityPolicy::from_config]
    AF --> D[ToolDispatcher\nnative/xml]
    AF --> PB[SystemPromptBuilder]
    AF --> ML[DefaultMemoryLoader]

    T --> SH[shell]
    T --> FR[file_read]
    T --> FW[file_write]
    T --> FE[file_edit]

    SH --> S
    SH --> R
    FR --> S
    FW --> S
    FE --> S

    A --> TURN[Agent::turn / run_interactive]
    TURN --> PB
    TURN --> D
    TURN --> P
    TURN --> T
    TURN --> MEM
    TURN --> O
```


## 关键路径流程图

```mermaid
sequenceDiagram
    participant U as User
    participant CLI as main.rs
    participant CFG as Config
    participant AG as Agent
    participant PB as PromptBuilder
    participant PR as Provider
    participant DP as Dispatcher
    participant TL as Tools
    participant SEC as SecurityPolicy

    U->>CLI: zeroclaw agent --message "任务"
    CLI->>CFG: load_or_init_with_override()
    CLI->>AG: agent::run(config, message)

    AG->>AG: Agent::from_config()
    AG->>PR: create_provider(openai-compatible)
    AG->>TL: register shell/file_read/file_write/file_edit
    AG->>SEC: build policy from autonomy + workspace

    AG->>PB: build_system_prompt()
    AG->>AG: append user message to history
    AG->>DP: to_provider_messages(history)
    DP->>PR: chat(messages, tools?, model, temperature)

    alt 模型直接回答
        PR-->>DP: text only
        DP-->>AG: final text
        AG-->>CLI: print response
        CLI-->>U: 输出结果
    else 模型请求工具
        PR-->>DP: text + tool_calls
        DP-->>AG: parsed tool calls
        AG->>TL: execute tool
        TL->>SEC: validate command/path/rate limit
        SEC-->>TL: allow/deny
        TL-->>AG: tool result
        AG->>DP: format_results()
        AG->>PR: 再次发送 history + tool results
        PR-->>AG: final answer
        AG-->>CLI: print response
        CLI-->>U: 输出结果
    end
```

## 一句话理解
这个最小版本质上就是：
CLI -> Config -> Agent -> OpenAI-compatible Provider + 4个本地工具 -> Security约束 -> 输出结果
不再包含 gateway、daemon、channels、硬件、浏览器工具、多 provider 路由、持久 memory backend 这些外围系统。
如果你要，我可以下一条继续给你一版“适合贴到 README 的精简版架构说明”，或者再补一张“启动装配流程图”。
