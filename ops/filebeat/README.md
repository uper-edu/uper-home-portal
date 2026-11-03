# Filebeat 日志采集(uper-home-portal → Elasticsearch)

生产 TKE 集群里以 DaemonSet 方式运行 Filebeat,只采集 `uper-home-portal`
容器的 stdout/stderr(单行 JSON),直写现有 Elasticsearch(与 ELK 共栈),
Kibana 数据视图 `prod-uper-home-portal-*` 即可查询。

- 集群命名空间:`middleware`(与 ELK 同处,复用 `elasticsearch-svc`)
- 镜像:`docker.elastic.co/beats/filebeat:8.17.0`(与 ES/Logstash/Kibana 同版本)
- 索引名:`prod-uper-home-portal-yyyyMMdd`(对齐现有 `prod-uper-*` 命名风格)
- 零 RBAC:不使用 kubernetes metadata processor,无需访问 API Server

## 与现有日志链路的关系

Java 服务(admin/student/workbench)自行经 TCP 5044 直发 Logstash
(`tcp + json_lines` 输入,Beats 协议不兼容),**不在本 Filebeat 的采集范围内**,
不会重复入库。`uper-home-portal` 不直发,由本 DaemonSet 采集容器日志文件。

## 部署 / 更新

```bash
# 1) Secret(密码不入库;值为 ELK 现网 elastic 凭据,轮换时同步更新)
kubectl -n middleware create secret generic filebeat-es-credentials \
  --from-literal=ELASTIC_PASSWORD='<elastic password>'

# 2) 对象(ConfigMap + DaemonSet)
kubectl apply -f ops/filebeat/filebeat-daemonset.yaml

# 3) 仅改了 ConfigMap 时需重启(subPath 挂载不会热更新)
kubectl -n middleware rollout restart ds/filebeat
```

访问入口(经跳板机 43.157.207.46 / TKE cls-rg1egwyb):

- ES:`http://10.20.0.138:9200`(内网 LB)或集群内 `elasticsearch-svc.middleware.svc:9200`
- Kibana:`http://10.20.0.138:5601`(内网 LB),数据视图 `prod-uper-home-portal-*`

## 扩大采集范围 / 回滚

- 扩量:编辑 ConfigMap `filebeat.yml` 的 `filebeat.inputs[].paths`,
  增加其它服务的 `/var/log/pods/<ns>_<app>-*/*/*.log` 通配,再 rollout restart。
- 回滚:`kubectl -n middleware delete ds/filebeat cm/filebeat-config secret/filebeat-es-credentials`
  并删除 Kibana 数据视图与 ES 索引 `prod-uper-home-portal-*`(如需)。

## 字段说明

应用日志为单行 JSON(`server/logger.ts`):`time/level/event/traceId/actor/leadId/...`
经 `decode_json_fields` 合并到文档根字段;非 JSON 行(旧版本文本、OOM 输出)保留在
`message`,原文存于 `error.data`。`envName`/`appName` 由 Filebeat 注入。
