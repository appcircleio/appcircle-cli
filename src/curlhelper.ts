import type { AxiosRequestConfig } from "axios";
import FormData from 'form-data';
const commonHeaders = ["common", "delete", "get", "head", "patch", "post", "put"]
export default class CurlHelper {
  private request: AxiosRequestConfig;
  constructor(config: AxiosRequestConfig) {
    this.request = config;
  }

  getHeaders() {
    let headers = this.request.headers,
      curlHeaders = "";

    //@ts-ignore
    if (headers.hasOwnProperty("common") && this.request.method) {
      //@ts-ignore
      headers = this.request.headers[this.request.method];
    }

    for (let property in this.request.headers) {
      if (!commonHeaders.includes(property)) {
        //@ts-ignore
        headers[property] = this.request.headers[property];
      }
    }

    for (let property in headers) {
      if ({}.hasOwnProperty.call(headers, property)) {

        if (this.request.data instanceof FormData && (/^content-type$/i).test(property)) {
          continue;
        }

        let header = `${property}:${headers[property]}`;
        curlHeaders = `${curlHeaders} -H "${header}"`;
      }
    }

    return curlHeaders.trim();
  }

  getMethod() {
    return `-X ${(this.request.method ?? "UNKNOWN").toUpperCase()}`;
  }

  parseFormData = (form: any) => form._streams.reduce((result: any, line: any) => {

    if (typeof line === 'string') {
      const key = line?.match(/\sname="(.*?)"/)?.[1];
      const filename = line?.match(/filename="(.*?)"/)?.[1];
      if (key) {
        result._currentKey = key;
        if (key === 'File') {
          result[result._currentKey] = filename;
          result['postData'] += ` -F "${key}=@${filename}"`;;
          delete result._currentKey;
        }
      } else if (line !== '\\r\\n') {
        result[result._currentKey] = line;
        result['postData'] += ` -F "${result._currentKey}=${line}"`;
        delete result._currentKey;
      }
    }
    return result;
  }, { postData: '' });

  getBody() {
    if (
      typeof this.request.data !== "undefined" &&
      this.request.data !== "" &&
      this.request.data !== null &&
      (this.request.method ?? "UNKNOWN").toUpperCase() !== "GET"
    ) {
      if (this.request.data instanceof FormData) {
        const formObjects = JSON.parse(JSON.stringify(this.request.data));
        const obj = this.parseFormData(formObjects);
        return obj.postData;
      }
      let data =
        typeof this.request.data === "object" ||
          Object.prototype.toString.call(this.request.data) === "[object Array]"
          ? JSON.stringify(this.request.data)
          : this.request.data;
      return `--data '${data}'`.trim();
    } else {
      return "";
    }
  }

  getUrl(): string | undefined {
    if (this.request.baseURL) {
      let baseUrl = this.request.baseURL
      let url = this.request.url
      let finalUrl = baseUrl + "/" + url
      return finalUrl
        .replace(/\/{2,}/g, '/')
        .replace("http:/", "http://")
        .replace("https:/", "https://")
    }
    return this.request.url;
  }

  getQueryString() {
    if (this.request.paramsSerializer) {
      const params = this.request.paramsSerializer(this.request.params)
      if (!params || params.length === 0) return ''
      if (params.startsWith('?')) return params
      return `?${params}`
    }
    let params = ""
    let i = 0

    for (let param in this.request.params) {
      if ({}.hasOwnProperty.call(this.request.params, param)) {
        params +=
          i !== 0
            ? `&${param}=${this.request.params[param]}`
            : `?${param}=${this.request.params[param]}`;
        i++;
      }
    }

    return params;
  }

  getBuiltURL() {
    let url = this.getUrl();

    if (this.getQueryString() !== "") {
      url += this.getQueryString();
    }

    return (url ?? "UNKNOWN_URL").trim();
  }

  generateCommand() {
    return `curl ${this.getMethod()} "${this.getBuiltURL()}" ${this.getHeaders()} ${this.getBody()}`
      .trim()
      .replace(/\s{2,}/g, " ");
  }
}
