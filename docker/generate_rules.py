
import sys

# Scopes for ThreadPools:internal
internal_scopes = [
    "AntiEntropyStage", "CacheCleanupExecutor", "CompactionExecutor",
    "GossipStage", "HintsDispatcher", "InternalResponseStage",
    "MemtableFlushWriter", "MemtablePostFlush", "MemtableReclaimMemory",
    "MigrationStage", "MiscStage", "PendingRangeCalculator",
    "PerDiskMemtableFlushWriter_0", "Sampler", "SecondaryIndexManagement",
    "ValidationExecutor"
]

# Scopes for ThreadPools:request
request_scopes = [
    "CounterMutationStage", "MutationStage", "ReadRepairStage",
    "RequestResponseStage", "ViewMutationStage"
]

# ClientRequest Scopes (Need Lowercase)
clientparam_scopes = [
    "Read", "Write", "CASRead", "CASWrite", "RangeSlice", "ViewWrite"
]

# Generate Rules
print("""
lowercaseOutputName: true
lowercaseOutputLabel: true

rules:
  # 0. HEAP MEMORY
  - pattern: 'java.lang<type=Memory><HeapMemoryUsage>(\w+)'
    name: cassandra_stats
    labels:
      name: "java:lang:memory:heapmemoryusage:$1"

  # 1. FAILURE DETECTOR
  - pattern: 'org.apache.cassandra.net<type=FailureDetector><>(UpEndpointCount|DownEndpointCount)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:net:failuredetector:$1"
    attrNameSnakeCase: true
""")

# Client Request Rules
print("  # 2. CLIENT REQUESTS (Unrolled)")
for scope in clientparam_scopes:
    lower_scope = scope.lower()
    print(f"""  - pattern: 'org.apache.cassandra.metrics<type=ClientRequest, scope={scope}, name=(Latency|Timeouts|Unavailables)><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:clientrequest:{lower_scope}:$1:$2"
    attrNameSnakeCase: true
""")

# ThreadPools Rules (Internal)
print("  # 3. THREAD POOLS (Internal - Unrolled)")
for scope in internal_scopes:
    lower_scope = scope.lower()
    for metric in ["ActiveTasks", "PendingTasks", "CurrentlyBlockedTasks"]:
        lower_metric = metric.lower()
        print(f"""  - pattern: 'org.apache.cassandra.metrics<type=ThreadPools, path=internal, scope={scope}, name={metric}><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:threadpools:internal:{lower_scope}:{lower_metric}:$1"
    attrNameSnakeCase: true
""")

# ThreadPools Rules (Request)
print("  # 3.2 THREAD POOLS (Request - Unrolled)")
for scope in request_scopes:
    lower_scope = scope.lower()
    for metric in ["ActiveTasks", "PendingTasks", "CurrentlyBlockedTasks"]:
        lower_metric = metric.lower()
        print(f"""  - pattern: 'org.apache.cassandra.metrics<type=ThreadPools, path=request, scope={scope}, name={metric}><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:threadpools:request:{lower_scope}:{lower_metric}:$1"
    attrNameSnakeCase: true
""")
        
# 3.3 Transport (Native-Transport-Requests -> native-transport-requests)
print("  # 3.3 Transport (Native-Transport-Requests - Unrolled)")
for metric in ["ActiveTasks", "PendingTasks", "CurrentlyBlockedTasks"]:
    lower_metric = metric.lower()
    print(f"""  - pattern: 'org.apache.cassandra.metrics<type=ThreadPools, path=transport, scope=Native-Transport-Requests, name={metric}><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:threadpools:transport:native-transport-requests:{lower_metric}:$1"
    attrNameSnakeCase: true
""")

# Dropped Messages (Unrolled)
print("  # 4. DROPPED MESSAGES (Unrolled)")
dropped_scopes = [
    "BATCH_REMOVE", "BATCH_STORE", "COUNTER_MUTATION", "HINT", "MUTATION",
    "PAGED_RANGE", "RANGE_SLICE", "READ", "READ_REPAIR", "REQUEST_RESPONSE", "_TRACE"
]
for scope in dropped_scopes:
    lower_scope = scope.lower()
    print(f"""  - pattern: 'org.apache.cassandra.metrics<type=DroppedMessage, scope={scope}, name=(Dropped)><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:droppedmessage:{lower_scope}:dropped:$2"
    attrNameSnakeCase: true
""")

# Compaction
print("""  # 5. COMPACTION (Specific lowercase mapping)
  - pattern: 'org.apache.cassandra.metrics<type=Compaction, name=BytesCompacted><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:compaction:bytescompacted:$1"
    attrNameSnakeCase: true

  - pattern: 'org.apache.cassandra.metrics<type=Compaction, name=PendingTasks><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:compaction:pendingtasks:$1"
    attrNameSnakeCase: true
    
  - pattern: 'org.apache.cassandra.metrics<type=Compaction, name=CompletedTasks><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:compaction:completedtasks:$1"
    attrNameSnakeCase: true
    
  - pattern: 'org.apache.cassandra.metrics<type=Compaction, name=TotalCompactionsCompleted><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:compaction:totalcompactionscompleted:$1"
    attrNameSnakeCase: true

  # 6. STORAGE (Exceptions)
  - pattern: 'org.apache.cassandra.metrics<type=Storage, name=Exceptions><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:storage:exceptions:$1"
    attrNameSnakeCase: true

  # 7. CONNECTION (TotalTimeouts)
  - pattern: 'org.apache.cassandra.metrics<type=Connection, name=TotalTimeouts><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:connection:totaltimeouts:$1"
    attrNameSnakeCase: true

  # 8. CLIENT CONNECTIONS
  - pattern: 'org.apache.cassandra.metrics<type=Client, name=ConnectedNativeClients><>Value'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:client:connectednativeclients:value"

  # 9. TABLE METRICS
  # LiveSSTableCount, SSTablesPerReadHistogram, CompactionBytesWritten
  - pattern: 'org.apache.cassandra.metrics<type=Table, keyspace=(\w+), scope=(\w+), name=LiveSSTableCount><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:table:livesstablecount:$3"
      keyspace: "$1"
      table: "$2"
    attrNameSnakeCase: true

  - pattern: 'org.apache.cassandra.metrics<type=Table, keyspace=(\w+), scope=(\w+), name=SSTablesPerReadHistogram><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:table:sstablesperreadhistogram:$3"
      keyspace: "$1"
      table: "$2"
    attrNameSnakeCase: true

  - pattern: 'org.apache.cassandra.metrics<type=Table, keyspace=(\w+), scope=(\w+), name=CompactionBytesWritten><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:table:compactionbyteswritten:$3"
      keyspace: "$1"
      table: "$2"
    attrNameSnakeCase: true

  # Fallback for other Tables
  - pattern: 'org.apache.cassandra.metrics<type=Table, keyspace=(\w+), scope=(\w+), name=(\w+)><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:table:$3:$4"
      keyspace: "$1"
      table: "$2"
    attrNameSnakeCase: true

  # 10. GENERAL FALLBACK (Low Priority)
  - pattern: 'org.apache.cassandra.metrics<type=(\w+), name=(\w+)><>(\w+)'
    name: cassandra_stats
    labels:
      name: "org:apache:cassandra:metrics:$1:$2:$3"
    attrNameSnakeCase: true

  # JVM
  - pattern: 'java.lang<type=Memory><(\w+)MemoryUsage>(\w+)'
    name: java_lang_memory_$1_$2
    type: GAUGE
  - pattern: 'java.lang<type=Threading><>ThreadCount'
    name: jvm_threads_current
    type: GAUGE
""")
