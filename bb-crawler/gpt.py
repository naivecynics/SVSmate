import requests
from bs4 import BeautifulSoup
import os
import urllib.parse
import getpass
import re


class BlackboardCrawler:
    def __init__(self):
        """初始化爬虫"""
        self.session = requests.Session()
        self.base_url = "https://bb.sustech.edu.cn"  # 南科大 Blackboard 地址
        self.login_url = f"{self.base_url}/webapps/login/"
        self.cas_url = "https://cas.sustech.edu.cn/cas/login"  # CAS 认证地址
        # 课程列表 AJAX 接口
        self.course_list_url = f"{self.base_url}/webapps/portal/execute/tabs/tabAction"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        }

    def login(self, username, password):
        """登录 Blackboard 系统通过 CAS 认证"""
        # 访问 Blackboard 登录页获取 CAS 重定向
        bb_response = self.session.get(self.login_url, headers=self.headers)

        # 检查是否被重定向到 CAS 登录页面
        cas_login_url = bb_response.url if "cas.sustech.edu.cn" in bb_response.url else f"{self.cas_url}?service={urllib.parse.quote(self.login_url)}"

        cas_response = self.session.get(cas_login_url, headers=self.headers)
        cas_soup = BeautifulSoup(cas_response.text, "xml")

        # 获取 execution token
        execution = cas_soup.find("input", {"name": "execution"})
        if not execution:
            print("❌ 无法找到 CAS 认证的 execution 参数")
            return False

        execution_value = execution.get("value")

        # 提交登录表单
        cas_login_data = {
            "username": username,
            "password": password,
            "execution": execution_value,
            "_eventId": "submit",
            "geolocation": "",
            "submit": "登录"
        }

        cas_login_response = self.session.post(
            cas_login_url,
            data=cas_login_data,
            headers=self.headers,
            allow_redirects=True
        )

        # 验证是否登录成功
        if "登出" in cas_login_response.text or "logout" in cas_login_response.text.lower():
            print("✅ CAS 认证成功，已登录 Blackboard!")
            return True
        else:
            print("❌ 登录失败，可能是用户名或密码错误")
            return False

    def get_courses(self):
        """获取课程列表（从 AJAX 加载）"""
        print("📡 正在获取课程列表...")
        payload = {
            "action": "refreshAjaxModule",
            "modId": "_3_1",
            "tabId": "_1_1",
            "tab_tab_group_id": "_1_1"
        }
        response = self.session.post(
            self.course_list_url, headers=self.headers, data=payload)

        with open("debug_courses_page.html", "w", encoding="utf-8") as f:
            f.write(response.text)
        print("已保存页面 HTML 到 debug_courses_page.html 用于调试")

        if response.status_code != 200:
            print("❌ 课程列表加载失败")
            return []

        soup = BeautifulSoup(response.text, "xml")
        courses = []

        # 查找所有课程链接
        for link in soup.find_all("a", href=True):
            href = link.get("href")
            if "course_id" in href:  # 只获取课程链接
                course_name = link.text.strip()
                course_url = f"{self.base_url}{href}"
                courses.append((course_name, course_url))

        return courses

    def get_course_pdfs(self, course_url):
        """获取课程中的 PDF 课件"""
        print(f"📡 正在爬取 {course_url} 的课件...")
        response = self.session.get(course_url, headers=self.headers)

        if "cas.sustech.edu.cn" in response.url:
            print("⚠️ 会话已过期，需要重新登录")
            return []

        soup = BeautifulSoup(response.text, "html.parser")
        pdfs = []

        # 查找所有 PDF 文件
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if href.endswith(".pdf") or "/bbcswebdav/" in href:
                name = link.text.strip()
                if not name:
                    name = os.path.basename(urllib.parse.urlparse(href).path)

                pdf_url = f"{self.base_url}{href}" if href.startswith(
                    "/") else href
                pdfs.append((name, pdf_url))

        return pdfs

    def download_pdf(self, pdf_url, save_path):
        """下载 PDF 文件"""
        response = self.session.get(pdf_url, headers=self.headers, stream=True)
        if response.status_code == 200:
            with open(save_path, "wb") as file:
                for chunk in response.iter_content(chunk_size=1024):
                    file.write(chunk)
            print(f"✅ {save_path} 下载完成！")
            return True
        else:
            print(f"❌ 下载失败: {pdf_url}, 状态码: {response.status_code}")
            return False


# 运行爬虫
if __name__ == "__main__":
    # username = input("请输入用户名: ")
    # password = getpass.getpass("请输入密码: ")
    username = '12213009'
    password = 'xwpc.769394'

    crawler = BlackboardCrawler()
    if crawler.login(username, password):
        courses = crawler.get_courses()

        if not courses:
            print("❌ 未找到任何课程，可能是解析问题或会话已过期")
            exit(1)

        print("\n📚 你已选的课程:")
        for idx, (name, url) in enumerate(courses, 1):
            print(f"{idx}. {name}")
            print(f"   🔗 {url}")

        # 选择课程爬取课件
        course_index = int(input("\n请输入课程编号以爬取课件: ")) - 1
        if 0 <= course_index < len(courses):
            course_name, course_url = courses[course_index]
            print(f"\n正在爬取 {course_name} 的课件...")

            pdfs = crawler.get_course_pdfs(course_url)
            if pdfs:
                download_dir = f"./downloads/{course_name}"
                os.makedirs(download_dir, exist_ok=True)

                for pdf_name, pdf_url in pdfs:
                    safe_name = re.sub(r'[\/:*?"<>|]', '_', pdf_name)  # 处理文件名
                    save_path = os.path.join(download_dir, safe_name + ".pdf")
                    crawler.download_pdf(pdf_url, save_path)

                print(f"\n✅ {len(pdfs)} 个文件已下载到 {download_dir}")
            else:
                print("⚠️ 该课程没有找到可下载的 PDF 文件！")
        else:
            print("❌ 无效的课程编号！")
