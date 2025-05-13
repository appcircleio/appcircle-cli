# `appcircle build variable group upload`

JSON dosyasından environment variable'ları bir variable grubuna yükle.

```plaintext
appcircle build variable group upload [options]
```

## Örnekler

```plaintext
$ appcircle build variable group upload --variableGroupId "Variable Group ID" --filePath "/path/to/variables.json"
```
         
## Seçenekler

```plaintext
      --variableGroupId <uuid>  Variable Group ID
      --filePath <string>       JSON dosya yolu
```                       

## Üst komutlardan miras alınan seçenekler

```plaintext
      --help   Komut yardımını göster
```

## JSON Dosya Formatı

JSON dosyası aşağıdaki formatta olmalıdır:

```json
[
  {
    "key": "VARIABLE_NAME",
    "value": "variable_value",
    "isSecret": false,
    "isFile": false,
    "id": "VARIABLE_NAME"
  },
  ...
]
``` 