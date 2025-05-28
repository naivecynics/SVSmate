<br />
<div align="center">
  <a href="https://github.com/naivecynics/SVSmate">
    <img src="https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/telescope.png" alt="Logo" width="100" height="100">
  </a>

  <h1 align="center">SVSmate</h1>

  <p align="center">
    The Ultimate VS Code Extension for SUSTechers
    <br />
    <div style="text-align: center;">
        <img src="https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/sustech.png" alt="SUSTech" width="60" style="margin: 0 40px;" />
        <img src="https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/separator.png" alt="separator" width="60" />
        <img src="https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/vscode.png" alt="VS Code" width="60" style="margin: 0 40px;" />
    </div>
    <br />
    <a href="https://github.com/naivecynics/SVSmate/issues/new?labels=enhancement&template=feature-request---.md">Request Feature</a>
    &middot;
    <a href="https://github.com/naivecynics/SVSmate/issues/new?labels=bug&template=bug-report---.md">Report Bug</a>
    &middot;
    <a href="https://github.com/naivecynics/SVSmate">中文文档 »</a>
  </p>
</div>


[![Version](https://img.shields.io/visual-studio-marketplace/v/naivecynics.svsmate?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=naivecynics.svsmate)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/naivecynics.svsmate?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=naivecynics.svsmate)
[![GitHub issues](https://img.shields.io/github/issues/naivecynics/SVSmate?style=flat-square)](https://github.com/naivecynics/SVSmate/issues)
[![Last Commit](https://img.shields.io/github/last-commit/naivecynics/SVSmate?style=flat-square)](https://github.com/naivecynics/SVSmate/commits/main)
[![License](https://img.shields.io/github/license/naivecynics/SVSmate?style=flat-square)](https://github.com/naivecynics/SVSmate/blob/main/LICENSE)

## 🚀 About the Project

> This project originated as the final project for the **25Spring CS304 - Software Engineering**.  

Our goal is to develop a powerful and user-friendly **VS Code extension** tailored for SUSTechers, aiming to simplify their academic workflows — particularly operations related to [Blackboard](https://bb.sustech.edu.cn/webapps/portal/execute/tabs/tabAction?tab_tab_group_id=_1_1).

### ✨ Key Features

- 🔗 Seamlessly connect VS Code with your personal **Blackboard** data  
- 📅 Automatically **sync your schedule and assignments**, and manage them with ease  
- 🤖 Handle tasks more efficiently with **AI-powered assistance**
- 📄 **Extract code snippets** from PDF course materials
- 🤝 **Collaborate** on files with teammates in real time  🚧 *In Development*

## 💾 Installation

SVSmate can be installed via the VS Code [Marketplace »](https://marketplace.visualstudio.com/items?itemName=naivecynics.svsmate)

Or download `.vsix` manually in [Release »](https://github.com/naivecynics/SVSmate/releases)

## 🛠️ Usage

### 🔗 Blackboard Crawler

> [!TIP]
> To ensure this feature works correctly, please configure your [Blackboard Settings](https://bb.sustech.edu.cn/webapps/portal/execute/tabs/tabAction?tab_tab_group_id=_1_1&forwardUrl=edit_module/_3_1/bbcourseorg?cmd%3Dedit&recallUrl=/webapps/portal/execute/tabs/tabAction?tab_tab_group_id%3D_1_1x) as shown below:  
>
> ![bb-setting](https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/bb-setting.png)

You can choose to update the entire course database, a specific semester, or individual course materials manually.  
The extension also intelligently downloads Blackboard documents directly into your workspace.  
Dive in and streamline your academic workflow!

> [!WARNING]
> Better check your **VPN status** before start crawling.


### 📅 Task Scheduler

Manage your SUSTech tasks effortlessly in VS Code. Tasks can be imported directly from Blackboard, as shown below:

> [!TIP]
> Click the **calendar icon** at the bottom of the [Blackboard Calendar](https://bb.sustech.edu.cn/webapps/bb-social-learning-BBLEARN/execute/mybb?cmd=display&toolId=calendar-mybb_____calendar-tool).  
>
> ![bb-ics](https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/bb-ics.png)

Paste your Blackboard calendar link to import tasks.  
Once imported, you're free to edit, organize, and schedule them as you like.

### 🤖 AI-Powered Features

Currently tested with the [Deepseek API](https://platform.deepseek.com/api_keys), though other APIs should also work in theory.

Paste your Deepseek (or other compatible) API key in the extension settings to enable AI-powered features.

After configuring your API key, you can:

1. Chat with your API agent: `@mate`
2. Automatically download Blackboard files to the correct directory
3. Generate intelligent subtask breakdowns
4. Read PDFs and extract code into files

Unlock the power of automation and AI to supercharge your study experience!

### 📄 Code Extractor

Quickly generate runnable code based on selected PDF content using AI.

To use this feature:

1. Click the icon on the right side of the Explorer.

> ![bb-ics](https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/bb-pdf-1.png)

2. Select the desired PDF file.

3. Input the start and end page numbers of the PDF.

> ![bb-ics](https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/bb-pdf-2.png)
> ![bb-ics](https://raw.githubusercontent.com/naivecynics/SVSmate/dev/media/bb-pdf-3.png)

4. Specify the type of code to generate.

5. Result will be generated in the current workspace.

The AI will process the selected content and generate runnable code directly into your open workspace. Simplify your workflow and save time with this powerful feature!

### 🤝 Collaborate Editing

> [!WARNING]
> Requires all users to be on the **same local network**

1. The **server** starts the session and shares the selected file.
2. The **client** discovers and joins the session to begin live editing.
3. Users can communicate via the built-in chat during the session.

## 📖 Documentation

Click here to view our [Develop Document »](https://naivecynics.github.io/SVSmate/)

## 💬 Contribute

Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

Don't forget to give our project a ⭐️! Thanks again!

1. Fork the Project
2. Create your Feature Branch 
3. Commit your Changes
4. Push to the Branch
5. Open a Pull Request

### ✅ TODO

- [ ] Add last update time in BB vault
- [ ] Add Chinese Document

### 👥 Contributors:

<a href="https://github.com/naivecynics/SVSmate/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=naivecynics/SVSmate" alt="Top Contributors" />
</a>

## 📜 License

Distributed under the MIT License. See `LICENSE.txt` for more information.
