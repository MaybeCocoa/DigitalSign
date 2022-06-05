let CADESCOM_BASE64_TO_BINARY = 1; 
let CAPICOM_CURRENT_USER_STORE = 2; // Хранилище текущего пользователя
let CAPICOM_MY_STORE = "My"; // Хранилище персональных сертификатов пользователя
let CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED = 2; // Открывает хранилище на чтение/запись, если пользователь
                                            // имеет права на чтение/запись. Если прав на запись нет, то
                                            // хранилище открывается на чтение
let CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME = 1;  // Возвращает сертификаты, наименование которого точно или 
                                                // частично совпадает с указанным
let CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256 = 101; // Алгоритм ГОСТ Р 34.11-2012

function hash() {
    cadesplugin.async_spawn(function* (args) {
        // Создаем объект CAdESCOM.HashedData
        let oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");

        // Алгоритм хэширования нужно указать до того, как будут переданы данные
        yield oHashedData.propset_Algorithm(CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256);

        // Указываем кодировку данных
        // Кодировка должна быть указана до того, как будут переданы сами данные
        yield oHashedData.propset_DataEncoding(CADESCOM_BASE64_TO_BINARY);

        // Предварительно закодированные в BASE64 бинарные данные
        // В данном случае закодирован файл со строкой "Some Data."
        let fileData = document.getElementById("file").files[0];
        
        let el = document.createElement("textarea");
        el.id = 'base64';
        let f = document.getElementById("formDoc");
        f.insertAdjacentElement('afterend', el);

        let fileReader = getBase64(fileData);
        console.log(fileReader);
        dataInBase64 = document.getElementById('base64').innerHTML;
        // console.log('THIS IS');
        // console.log(dataInBase64);
        // console.log('DATAINBASE64');
        //var dataInBase64 = "U29tZSBEYXRhLg==";

        // Передаем данные
        yield oHashedData.Hash(dataInBase64);
        console.log(oHashedData);

        // Получаем хэш-значение
        let sHashValue = yield oHashedData.Value;
        // Это значение будет совпадать с вычисленным при помощи, например,
        // утилиты cryptcp от тех же исходных _бинарных_ данных.

        let element = document.createElement("textarea");
        element.id = 'hashVal';
        let form = document.getElementById("base64");
        form.insertAdjacentElement('afterend', element);
        document.getElementById("hashVal").innerHTML = `HASH: ${sHashValue}`;
        console.log('hashVal создан');
        sign();
    });
}

function getBase64(file){
    let reader = new FileReader();
    // reader.readAsDataURL(file);
    reader.readAsDataURL(file);
    reader.onload = () => document.getElementById('base64').innerHTML = reader.result;
}

function sign(){
    cadesplugin.async_spawn(function* (args) {
        // let oCertName = document.getElementById("CertName");
        // let sCertName = oCertName.value; // Здесь следует заполнить SubjectName сертификата
        
        let sCertName = prompt('Введите имя сертификата');
        if ("" === sCertName) {
            alert("Введите имя сертификата (CN).");
            return;
        }

        // Предварительно вычисленное хэш-значение в виде строки шестнадцатеричных цифр,
        // группами по 2 цифры на байт, с пробелами или без пробелов.
        // Например, хэш-значение в таком формате возвращают объекты
        // CAPICOM.HashedData и CADESCOM.HashedData.
        let sHashValue = yield document.getElementById("hashVal").innerHTML.split(" ")[1];

        // Алгоритм хэширования, при помощи которого было вычислено хэш-значение
        // Полный список поддерживаемых алгоритмов указан в перечислении CADESCOM_HASH_ALGORITHM
        let hashAlg = CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256; // ГОСТ Р 34.11-12

        // Находим сертификат подписанта в хранилище
        let oStore = yield cadesplugin.CreateObjectAsync("CAdESCOM.Store");
        yield oStore.Open(CAPICOM_CURRENT_USER_STORE, CAPICOM_MY_STORE,
            CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED);

        let oStoreCerts = yield oStore.Certificates;
        let oCertificates = yield oStoreCerts.Find(
            CAPICOM_CERTIFICATE_FIND_SUBJECT_NAME, sCertName);
        let certsCount = yield oCertificates.Count;
        if (certsCount === 0) {
            alert("Certificate not found: " + sCertName);
            return;
        }
        let oCertificate = yield oCertificates.Item(1);
        yield oStore.Close();

        // Создаем объект CAdESCOM.HashedData
        let oHashedData = yield cadesplugin.CreateObjectAsync("CAdESCOM.HashedData");

        // Инициализируем объект заранее вычисленным хэш-значением
        // Алгоритм хэширования нужно указать до того, как будет передано хэш-значение
        yield oHashedData.propset_Algorithm(hashAlg);
        yield oHashedData.SetHashValue(sHashValue);

        // Создаем объект CAdESCOM.RawSignature
        let oRawSignature = yield cadesplugin.CreateObjectAsync("CAdESCOM.RawSignature");

        // Вычисляем значение подписи
        let sRawSignature = yield oRawSignature.SignHash(oHashedData, oCertificate);
        console.log(sRawSignature);
      
        let element = document.createElement("textarea");
        element.id = 'signature';
        let hashValue = document.getElementById("hashVal");
        hashValue.insertAdjacentElement('afterend', element);
        document.getElementById('signature').innerHTML = `SIGNATURE: ${sRawSignature}`;

        let oRawSignature2 = yield cadesplugin.CreateObjectAsync("CAdESCOM.RawSignature");

        // Проверяем подпись
        try {
            yield oRawSignature2.VerifyHash(oHashedData, oCertificate, sRawSignature);
            alert("Signature verified");
        }
        catch (err) {
            alert("Failed to verify signature. Error: " + cadesplugin.getLastError(err));
            return false;
        }
    });
}

function run(){
    hash();
}