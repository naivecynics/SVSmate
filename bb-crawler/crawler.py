from io import text_encoding
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
import os
import urllib.parse
import re
import yaml
import json
import shutil
from tqdm import tqdm


class BlackboardCrawler:
    def __init__(self):
        """initialize cravler"""

        # personal username & password
        self.user_info_path = "./login.yaml"

        # bb-vault bath path
        self.base_path = "./bb-vault/"

        self.session = requests.Session()
        self.base_url = "https://bb.sustech.edu.cn"
        self.login_url = f"{self.base_url}/webapps/login/"
        self.cas_url = "https://cas.sustech.edu.cn/cas/login"

        # 课程列表 AJAX 接口
        self.course_list_url = f"{self.base_url}/webapps/portal/execute/tabs/tabAction"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        }

        self.DEBUG = False

    def login(self):
        """登录 Blackboard 系统通过 CAS 认证"""
        with open(self.user_info_path, "r", encoding="utf-8") as file:
            info = yaml.safe_load(file)
            username = info["username"]
            password = info["password"]

        # 访问 Blackboard 登录页获取 CAS 重定向
        bb_response = self.session.get(self.login_url, headers=self.headers)

        # 检查是否被重定向到 CAS 登录页面
        cas_login_url = (
            bb_response.url
            if "cas.sustech.edu.cn" in bb_response.url
            else f"{self.cas_url}?service={urllib.parse.quote(self.login_url)}"
        )

        cas_response = self.session.get(cas_login_url, headers=self.headers)
        cas_soup = BeautifulSoup(cas_response.text, "xml")

        # 获取 execution token
        execution = cas_soup.find("input", {"name": "execution"})
        if not execution:
            print("❌ 无法找到 CAS 认证的 execution 参数")
            return False

        execution_value = execution.get("value")

        # print(execution_value)

        # 提交登录表单
        cas_login_data = {
            "username": username,
            "password": password,
            "execution": execution_value,
            "_eventId": "submit"
            # "geolocation": "",
            # "submit": "登录"
        }

        cas_login_response = self.session.post(
            cas_login_url, data=cas_login_data, headers=self.headers, allow_redirects=True
        )

        # print(cas_login_response.text)

        # 验证是否登录成功
        if "登出" in cas_login_response.text or "logout" in cas_login_response.text.lower():
            print("CAS 认证成功，已登录 Blackboard!")
            return True
        else:
            print("登录失败，可能是用户名或密码错误")
            return False

    def print_courses_info(self, courses, which_term=None, annoucement=False):
        for term, course_list in courses.items():
            if which_term is not None and term != which_term:
                continue
            print(f"\n📚 {term}:")
            for course in course_list:
                print(f"  - {course['name']}\n    + {course['url']}")
                if annoucement == True and course["announcement"]:
                    print("    📢 公anoucnement")
                    for ann_text, ann_url in course["announcement"]:
                        print(f"      - {ann_text}: {ann_url}")

    def parse_vault(self):
        """从bb主页获取课程列表（从 AJAX 加载）"""

        print("📡 正在获取课程列表...")
        payload = {"action": "refreshAjaxModule", "modId": "_3_1", "tabId": "_1_1", "tab_tab_group_id": "_1_1"}
        response = self.session.post(self.course_list_url, headers=self.headers, data=payload)

        if response.status_code != 200:
            print("❌ 课程列表加载失败")
            return []

        xml_data = response.text

        # **解析 XML，提取 CDATA 内的 HTML**
        try:
            root = ET.fromstring(xml_data)
            html_content = root.text  # 直接取 root.text 可能为空
            if not html_content:
                print("⚠️ 提取的 HTML 为空，可能解析错误")
                return []

            # **使用 BeautifulSoup 解析 HTML**
            soup = BeautifulSoup(html_content, "html.parser")

            # 存储课程信息
            courses = {}

            # **遍历所有学期**
            for term in soup.find_all("h3", class_="termHeading-coursefakeclass"):
                term_name = term.get_text(strip=True)  # 获取学期名称
                match = re.search(r"（(Spring|Fall|Summer|Winter) (\d{4})）", term_name)
                if match:
                    season = match.group(1).lower()  # 转小写
                    year = match.group(2)[-2:]  # 获取年份后两位
                    term_name = f"{year}{season}"
                else:
                    term_name = "unknown"

                courses[term_name] = []

                # 🔹 获取学期对应的课程列表 `<div>`
                a_tag = term.find("a", id=True)
                if a_tag:
                    term_id_match = re.search(r"termCourses__\d+_\d+", a_tag["id"])
                    if term_id_match:
                        term_id = "_3_1" + term_id_match.group()  # 确保 ID 结构完整
                        course_list_div = soup.find("div", id=term_id)

                        if course_list_div:
                            # 遍历该学期的所有课程
                            for course_li in course_list_div.find_all("li"):
                                course_link = course_li.find("a", href=True)

                                # 🛑 **跳过公告的 `<a>`，只处理课程**
                                if not course_link or "announcement" in course_link["href"]:
                                    continue  # 如果是公告，跳过

                                    # ✅ 课程信息
                                course_name = course_link.get_text(strip=True)
                                course_url = course_link["href"].strip()
                                full_course_url = f"https://bb.sustech.edu.cn{course_url}"

                                # **查找公告信息**
                                announcements = {}
                                course_data_block = course_li.find("div", class_="courseDataBlock")
                                if course_data_block:
                                    # **移除 "公告: " 标签**
                                    span_label = course_data_block.find("span", class_="dataBlockLabel")
                                    if span_label:
                                        span_label.extract()  # 删除 "公告: " 这个标签

                                    # **遍历公告信息**
                                    for ann in course_data_block.find_all("a", href=True):
                                        announcements["content"] = ann.get_text(strip=True)
                                        announcements["url"] = f"https://bb.sustech.edu.cn{ann['href'].strip()}"

                                # ✅ **存储课程数据**
                                courses[term_name].append(
                                    {
                                        "name": course_name,
                                        "url": full_course_url,
                                        "announcement": announcements,  # 这里不再包含错误的课程
                                    }
                                )

            if self.DEBUG:
                # **保存 HTML 以便调试**
                with open("cache/debug-main-page.html", "w", encoding="utf-8") as f:
                    f.write(response.text)
                print("✅ 已保存页面 HTML 到 cache/debug-main-page.html 用于调试")

                with open("cache/courses.json", "w", encoding="utf-8") as f:
                    json.dump(courses, f, ensure_ascii=False, indent=4)
                print("✅ 课程数据已成功保存到 cache/courses.json！")

            return courses

        except ET.ParseError as e:
            print(f"❌ XML 解析错误: {e}")
            return None

    def parse_course(self, url):
        """从课程主页抓取页面 HTML 并提取侧边栏的session链接"""

        try:
            # 发送请求并跟随重定向
            response = self.session.get(url, allow_redirects=True)
            response.raise_for_status()  # 检查请求是否成功

            final_url = response.url  # 获取最终的 URL
            print(f"🔀 已重定向到: {final_url}")

            # 解析 HTML
            soup = BeautifulSoup(response.text, "html.parser")

            # 确保缓存目录存在
            os.makedirs("cache", exist_ok=True)

            # 保存完整的 HTML 页面
            html_path = "cache/debug-site-page.html"
            with open(html_path, "w", encoding="utf-8") as file:
                file.write(response.text)
            print(f"✅ 页面已保存到 {html_path}")

            # 提取侧边栏结构
            sidebar_structure = self.extract_sidebar_links(soup)

            if self.DEBUG:
                # 保存解析后的 JSON
                json_path = "cache/sidebar_links.json"
                with open(json_path, "w", encoding="utf-8") as json_file:
                    json.dump(sidebar_structure, json_file, indent=4, ensure_ascii=False)
                print(f"✅ 侧边栏链接已解析并保存到 {json_path}")

            return sidebar_structure

        except requests.exceptions.RequestException as e:
            print(f"❌ 请求失败: {e}")
            return None

    def extract_sidebar_links(self, soup):
        """session HTML -> page url & name"""

        sidebar_menu = {}

        # 找到课程菜单 ul 标签
        menu_ul = soup.find("ul", id="courseMenuPalette_contents")
        if not menu_ul:
            print("❌ 未找到课程菜单")
            return {}

        # 课程 ID（用于构造正确的 Announcements 链接）
        course_id_match = re.search(r"course_id=(_\d+_\d+)", str(soup))
        course_id = course_id_match.group(1) if course_id_match else None

        current_category = None
        for li in menu_ul.find_all("li", recursive=False):
            # 处理分类标题（<h3>）
            category_tag = li.find("h3")
            if category_tag:
                current_category = category_tag.get_text(strip=True)
                sidebar_menu[current_category] = []
                continue  # 跳过当前 <li> 的后续解析

            # 处理课程内容链接
            link_tag = li.find("a", href=True)
            if link_tag:
                link_text = link_tag.get_text(strip=True)
                link_url = f"https://bb.sustech.edu.cn{link_tag['href']}"

                # 特殊处理 Announcements（替换 URL）
                if "Announcements" in link_text and course_id:
                    link_url = f"https://bb.sustech.edu.cn/webapps/blackboard/execute/announcement?method=search&context=course_entry&course_id={course_id}&handle=announcements_entry&mode=view"

                # 添加到当前分类
                if current_category:
                    sidebar_menu[current_category].append({"title": link_text, "url": link_url})
                else:
                    # 如果没有分类，直接存入根结构
                    sidebar_menu[link_text] = link_url

        return sidebar_menu

    def parse_page(self, url):
        """从page中提取entries的name和内容"""

        try:
            # 发送请求并跟随重定向
            response = self.session.get(url, allow_redirects=True)
            response.raise_for_status()  # 检查请求是否成功

            final_url = response.url  # 获取最终的 URL
            print(f"🔀 已重定向到: {final_url}")

            # 解析 HTML
            soup = BeautifulSoup(response.text, "html.parser")

            page = self.extract_file_structure(soup)

            if self.DEBUG:
                # ** 保存 JSON**
                output_path = "cache/extracted_files.json"
                with open(output_path, "w", encoding="utf-8") as json_file:
                    json.dump(file_structure, json_file, ensure_ascii=False, indent=4)
                print(f"✅ 提取的文件结构已保存到 {output_path}")

                # 保存完整的 HTML 页面
                html_path = "cache/debug-page-page.html"
                with open(html_path, "w", encoding="utf-8") as file:
                    file.write(response.text)
                print(f"✅ 页面已保存到 {html_path}")

            return page

        except requests.exceptions.RequestException as e:
            print(f"❌ 请求失败: {e}")
            return None

    def extract_file_structure(self, soup):
        """解析 Blackboard 页面，提取文件和文本结构"""
        if soup is None:
            print("❌ 解析失败，无法提取文件结构")
            return {}

        file_structure = {}

        # 遍历所有的内容区域
        for item in soup.find_all("li", class_="clearfix liItem read"):
            # 获取周次标题
            week_title_tag = item.find("h3")
            if not week_title_tag:
                continue

            week_title = week_title_tag.get_text(strip=True)
            content = ""

            # **1️⃣ 提取文本信息**
            details_div = item.find("div", class_="details")
            if details_div:
                content = details_div.get_text("\n", strip=True)  # 提取纯文本，保持换行

            # **2️⃣ 获取文件列表**
            files = []
            for file_li in item.find_all("li"):
                file_link = file_li.find("a", href=True)
                if file_link:
                    file_name = file_link.get_text(strip=True)
                    file_url = file_link["href"].strip()

                    # **过滤掉无效 URL**
                    if file_url.startswith("#") or "close" in file_url:
                        continue

                    # **转换相对 URL**
                    if not file_url.startswith("http"):
                        file_url = f"{self.base_url}{file_url}"

                    # **确保文件名不为空**
                    if file_name:
                        files.append({"name": file_name, "url": file_url})

            # **3️⃣ 组织数据结构**
            file_structure[week_title] = {"text": content, "files": files}

        return file_structure

    def download_file(self, url, save_path):
        """下载文件，带错误处理和跳过失败项"""

        # **1️⃣ 确保文件名安全**
        safe_filename = os.path.basename(save_path).replace(" ", "_")
        save_path = os.path.join(os.path.dirname(save_path), safe_filename)

        try:
            # **2️⃣ 尝试正常下载**
            response = self.session.get(url, stream=True, timeout=10, verify=True)
            response.raise_for_status()
        except requests.exceptions.SSLError:
            print(f"⚠️ SSL 失败，尝试降级 SSL 连接: {url}")
            try:
                response = self.session.get(url, stream=True, timeout=10, verify=False)  # 不验证 SSL（仅用于调试）
            except requests.exceptions.RequestException as e:
                print(f"❌ SSL 降级仍失败，跳过文件: {url} - {e}")
                return False  # 跳过该文件

        except requests.exceptions.RequestException as e:
            print(f"❌ 请求失败，跳过文件: {url} - {e}")
            return False  # 跳过该文件

        # **3️⃣ 获取文件大小**
        total_size = int(response.headers.get("content-length", 0))

        # **4️⃣ 逐块写入文件，并显示进度**
        try:
            with open(save_path, "wb") as file, tqdm(
                desc=f"⬇️ {safe_filename}",
                total=total_size,
                unit="B",
                unit_scale=True,
                unit_divisor=1024,
            ) as bar:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        file.write(chunk)
                        bar.update(len(chunk))
        except Exception as e:
            print(f"❌ 文件写入失败，跳过文件: {save_path} - {e}")
            return False

        print(f"✅ 下载完成: {save_path}")
        return True  # 文件下载成功

    def crawl(self, terms):
        """爬取指定学期的课程"""

        # clear cache
        if os.path.exists(self.base_path):
            shutil.rmtree(self.base_path)
        os.makedirs(self.base_path, exist_ok=True)
        print(f"🗑️  清空文件夹: {self.base_path}")

        vault = self.parse_vault()

        for term in terms:
            term_path = os.path.join(self.base_path, term)
            os.makedirs(term_path, exist_ok=True)

            courses = vault[term]

            for course in courses:
                course_name = course["name"].replace(" ", "_")
                course_url = course["url"]

                course_path = os.path.join(term_path, course_name)
                os.makedirs(course_path, exist_ok=True)

                sessions = self.parse_course(course_url)

                for session_name, pages in sessions.items():
                    session_path = os.path.join(course_path, session_name.replace(" ", "_"))
                    os.makedirs(session_path, exist_ok=True)

                    for page in pages:
                        page_name = page["title"].replace(" ", "_")
                        page_url = page["url"]

                        page_path = os.path.join(session_path, page_name)
                        os.makedirs(page_path, exist_ok=True)

                        entries = self.parse_page(page_url)

                        if not entries:
                            continue

                        # **下载附件**
                        for entry_name, entry in entries.items():
                            entry_path = os.path.join(page_path, entry_name)
                            os.makedirs(entry_path, exist_ok=True)

                            text = entry["text"]

                            # **存储文本**
                            if text != "":
                                text_file_path = os.path.join(entry_path, "text.txt")
                                with open(text_file_path, "w", encoding="utf-8") as text_file:
                                    text_file.write(text)
                                print(f"📄 文字内容已保存: {text_file_path}")

                            for file in entry.get("files", []):
                                file_name = file["name"].replace(" ", "_")
                                file_url = file["url"]
                                file_path = os.path.join(entry_path, file_name)
                                self.download_file(file_url, file_path)

            print(f"📥 {term}的课程资料爬取完毕！")


if __name__ == "__main__":

    terms = ["25spring"]

    crawler = BlackboardCrawler()
    if crawler.login():

        # debug logic

        # courses = crawler.update_sites()
        # crawler.print_courses_info(courses, which_term=term, annoucement=False)
        #
        # url = courses[term][2]['url']
        # print(url)
        # pages = crawler.parse_course(url)
        #
        # crawler.parse_page(pages['Course Materials'][1]['url'])

        # start to crawl
        crawler.crawl(terms)
