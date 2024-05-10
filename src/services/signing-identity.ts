
import fs from 'fs';
import FormData from 'form-data';
import { ProgramError } from '../core/ProgramError';
import { OptionsType, appcircleApi, getHeaders } from './api';
import axios from 'axios';
import { CountriesList, IOSCertificateStoreTypes } from '../constant';

const ROOTPATH = 'signing-identity';
  export async function getiOSP12Certificates() {
    const certificates = await appcircleApi.get(`${ROOTPATH}/v2/certificates`, {
      headers: getHeaders(),
    });

    // This API only list P12 certificates. 
    const result = certificates.data?.map((certificate : any) => ({...certificate,extension: 'P12'}));
    return result;
  }

  export async function getAndroidKeystores() {
    const keystores = await appcircleApi.get(`${ROOTPATH}/v2/keystores`, {
      headers: getHeaders(),
    });

    return keystores.data;
  }
  
  export async function uploadAndroidKeystoreFile(options: OptionsType<{ name: string, password: string, aliasPassword: string }>){
    const data = new FormData();
    data.append('Binary', fs.createReadStream(options.path));
    data.append('KeystorePassword', options.password);
    data.append('AliasPassword', options.aliasPassword);
    const uploadResponse = await appcircleApi.post(`${ROOTPATH}/v2/keystores/binary`,data, {
        maxBodyLength: Infinity,
        headers: {
          ...getHeaders(),
          ...data.getHeaders(),
        }
    });
    return uploadResponse.data;
  }

  export async function generateNewKeystore(options: OptionsType<{ name: string, password: string, passwordConfirm: string, validity: string,alias: string, aliasPassword: string, aliasPasswordConfirm :string }>) {
    const keystores = await appcircleApi.post(`${ROOTPATH}/v2/keystores`,options, {
      headers: getHeaders(),
    });

    return keystores.data;
  }

  export async function getCertificateDetailById(options: OptionsType<{ certificateBundleId: string }>) {
    const certificate = await appcircleApi.get(`${ROOTPATH}/v2/certificates/${options.certificateBundleId}`, {
        headers: getHeaders(),
      });
      return certificate.data;
  }
  export async function getKeystoreDetailById(options: OptionsType<{ keystoreId: string }>) {
    const keystore = await appcircleApi.get(`${ROOTPATH}/v2/keystores/${options.keystoreId}`, {
        headers: getHeaders(),
      });
      return keystore.data;
  }

  export async function downloadKeystoreById(options: OptionsType<{ keystoreId: string, path: string }>, downloadPath: string,fileName:string){
    const data = new FormData();
    data.append('Path', downloadPath);
    data.append('Keystore Id', options.keystoreId);
    const downloadResponse = await appcircleApi.get(`${ROOTPATH}/v2/keystores/${options.keystoreId}`, {
        responseType:'stream',
        headers: {
            ...getHeaders(),
            ...data.getHeaders(),
        },
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(`${downloadPath}/${fileName}`);
        downloadResponse.data.pipe(writer);
        let error: any = null;
        writer.on('error', (err) => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) {
            resolve(true);
          }
          //no need to call the reject here, as it will have been called in the
          //'error' stream;
        });
      });
  }
  export async function downloadCertificateById(options: OptionsType<{ certificateId: string, path: string }>,downloadPath: string,fileName: string,extension: 'p12' | 'csr') {
    const url = extension === 'p12' ? `${ROOTPATH}/v2/certificates/${options.certificateId}` : `${ROOTPATH}/v1/csr/${options.certificateId}`
    const data = new FormData();
    data.append('Path', downloadPath);
    data.append('Certificate Id', options.certificateId);
    const downloadResponse = await appcircleApi.get(url, {
        responseType:'stream',
        headers: {
            ...getHeaders(),
            ...data.getHeaders(),
        },
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(`${downloadPath}/${fileName}`);
        downloadResponse.data.pipe(writer);
        let error: any = null;
        writer.on('error', (err) => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) {
            resolve(true);
          }
          //no need to call the reject here, as it will have been called in the
          //'error' stream;
        });
      });
  }

  export async function removeCSRorP12CertificateById(options: OptionsType<{ certificateId: string, path: string }>, extension: 'p12' | 'csr'){
    const url = extension === 'p12' ? `${ROOTPATH}/v2/certificates/${options.certificateId}` : `${ROOTPATH}/v1/csr/${options.certificateId}`
    const response = await appcircleApi.delete(url, {
        headers: getHeaders(),
    });
    return response.data;
  }

  export async function removeKeystore(options: OptionsType<{ keystoreId: string }>){
    const response = await appcircleApi.delete(`${ROOTPATH}/v2/keystores/${options.keystoreId}`, {
        headers: getHeaders(),
    });
    return response.data;
  }

  export async function getiOSCSRCertificates() {
    const certificates = await appcircleApi.get(`${ROOTPATH}/v1/csr`, {
      headers: getHeaders(),
    });
    // This API only list CSR certificates. 
    const result = certificates.data?.map((certificate : any) => ({...certificate,extension: 'CSR',storeType: 1}));
    return result;
  }

  export async function getProvisioningProfiles() {
    const result = await appcircleApi.get(`${ROOTPATH}/v2/provisioning-profiles`, {
      headers: getHeaders(),
    });
    return result.data;
  }
  export async function downloadProvisioningProfileById(options: OptionsType<{ provisioningProfileId: string }>, downloadPath: string, fileName:string){
    const data = new FormData();
    data.append('Path', downloadPath);
    data.append('Profisioning Profile Id', options.provisioningProfileId);
    const downloadResponse = await appcircleApi.get(`${ROOTPATH}/v2/provisioning-profiles/${options.provisioningProfileId}`, {
        responseType:'stream',
        headers: {
            ...getHeaders(),
            ...data.getHeaders(),
        },
      });

      return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(`${downloadPath}/${fileName}`);
        downloadResponse.data.pipe(writer);
        let error: any = null;
        writer.on('error', (err) => {
          error = err;
          writer.close();
          reject(err);
        });
        writer.on('close', () => {
          if (!error) {
            resolve(true);
          }
          //no need to call the reject here, as it will have been called in the
          //'error' stream;
        });
      });
  }
  export async function getProvisioningProfileDetailById(options: OptionsType<{ provisioningProfileId: string }>){
    const result = await appcircleApi.get(`${ROOTPATH}/v2/provisioning-profiles/${options.provisioningProfileId}`, {
      headers: getHeaders(),
    });
    return result.data;
  }
  export async function uploadProvisioningProfile(options: OptionsType<{ path: string }>){
    const data = new FormData();
    data.append('Binary', fs.createReadStream(options.path));
    const uploadResponse = await appcircleApi.post(`${ROOTPATH}/v2/provisioning-profiles`,data, {
        maxBodyLength: Infinity,
        headers: {
          ...getHeaders(),
          ...data.getHeaders(),
        }
    });
    return uploadResponse.data;
  }

  export async function removeProvisioningProfile(options: OptionsType<{ provisioningProfileId: string }>){
    const response = await appcircleApi.delete(`${ROOTPATH}/v1/provisioning-profiles/${options.provisioningProfileId}`, {
        headers: getHeaders(),
    });
    return response.data;
  }
  export async function uploadP12Certificate(options: OptionsType<{ path: string, password: string }>) {
    const data = new FormData();
    data.append('binary', fs.createReadStream(options.path));
    data.append('password', options.password);
    const uploadResponse = await appcircleApi.post(`${ROOTPATH}/v2/certificates`,data, {
        maxBodyLength: Infinity,
        headers: {
          ...getHeaders(),
          ...data.getHeaders(),
        }
    });
    return uploadResponse.data;
  }


  export async function createCSRCertificateRequest(options: OptionsType<{ name: string, email: string,countryCode:string }>) {
    const createResponse = await appcircleApi.post(`${ROOTPATH}/v1/csr`,options, {
        headers: {
          ...getHeaders(),
        }
    });
    return { ...createResponse.data, storeType: 1};
  }