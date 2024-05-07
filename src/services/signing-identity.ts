
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

  export async function getCertificateDetailById(options: OptionsType<{ certificateBundleId: string }>) {
    const certificate = await appcircleApi.get(`${ROOTPATH}/v2/certificates/${options.certificateBundleId}`, {
        headers: getHeaders(),
      });
      return certificate.data;
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
  export async function getiOSCSRCertificates() {
    const certificates = await appcircleApi.get(`${ROOTPATH}/v1/csr`, {
      headers: getHeaders(),
    });
    // This API only list CSR certificates. 
    const result = certificates.data?.map((certificate : any) => ({...certificate,extension: 'CSR',storeType: 1}));
    return result;
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