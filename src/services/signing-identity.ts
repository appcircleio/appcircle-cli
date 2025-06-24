
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

  export async function getCertificateDetailById(options: OptionsType<{ certificateBundleId?: string; certificate?: string }>) {
    let certificateBundleId = options.certificateBundleId || '';

    // Resolve certificate name to certificateBundleId if provided
    if (!certificateBundleId && options.certificate) {
      const certificates = await getiOSP12Certificates();
      const cert = certificates.find((c: any) => c.name === options.certificate);
      if (cert) {
        certificateBundleId = cert.id;
      } else {
        throw new ProgramError(`Certificate with name "${options.certificate}" not found.`);
      }
    }

    if (!certificateBundleId) {
      throw new ProgramError('Either certificateBundleId or certificate name is required.');
    }

    const certificate = await appcircleApi.get(`${ROOTPATH}/v2/certificates/${certificateBundleId}`, {
        headers: getHeaders(),
      });
      return certificate.data;
  }
  export async function getKeystoreDetailById(options: OptionsType<{ keystoreId?: string; keystore?: string }>) {
    let keystoreId = options.keystoreId || '';

    // Resolve keystore name to keystoreId if provided
    if (!keystoreId && options.keystore) {
      const keystores = await getAndroidKeystores();
      const ks = keystores.find((k: any) => k.name === options.keystore);
      if (ks) {
        keystoreId = ks.id;
      } else {
        throw new ProgramError(`Keystore with name "${options.keystore}" not found.`);
      }
    }

    if (!keystoreId) {
      throw new ProgramError('Either keystoreId or keystore name is required.');
    }

    const keystore = await appcircleApi.get(`${ROOTPATH}/v2/keystores/${keystoreId}`, {
        headers: getHeaders(),
      });
      return keystore.data;
  }

  export async function downloadKeystoreById(options: OptionsType<{ keystoreId?: string; keystore?: string; path: string }>, downloadPath: string,fileName:string){
    let keystoreId = options.keystoreId || '';

    // Resolve keystore name to keystoreId if provided
    if (!keystoreId && options.keystore) {
      const keystores = await getAndroidKeystores();
      const ks = keystores.find((k: any) => k.name === options.keystore);
      if (ks) {
        keystoreId = ks.id;
      } else {
        throw new ProgramError(`Keystore with name "${options.keystore}" not found.`);
      }
    }

    if (!keystoreId) {
      throw new ProgramError('Either keystoreId or keystore name is required.');
    }

    const data = new FormData();
    data.append('Path', downloadPath);
    data.append('Keystore Id', keystoreId);
    const downloadResponse = await appcircleApi.get(`${ROOTPATH}/v2/keystores/${keystoreId}`, {
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
  export async function downloadCertificateById(options: OptionsType<{ certificateId?: string; certificate?: string; path: string }>,downloadPath: string,fileName: string,extension: 'p12' | 'csr') {
    let certificateId = options.certificateId || '';

    // Resolve certificate name to certificateId if provided
    if (!certificateId && options.certificate) {
      const certificates = await getiOSP12Certificates();
      const cert = certificates.find((c: any) => c.name === options.certificate);
      if (cert) {
        certificateId = cert.id;
      } else {
        throw new ProgramError(`Certificate with name "${options.certificate}" not found.`);
      }
    }

    if (!certificateId) {
      throw new ProgramError('Either certificateId or certificate name is required.');
    }

    const url = extension === 'p12' ? `${ROOTPATH}/v2/certificates/${certificateId}` : `${ROOTPATH}/v1/csr/${certificateId}`
    const data = new FormData();
    data.append('Path', downloadPath);
    data.append('Certificate Id', certificateId);
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

  export async function removeCSRorP12CertificateById(options: OptionsType<{ certificateId?: string; certificate?: string; path: string }>, extension: 'p12' | 'csr'){
    let certificateId = options.certificateId || '';

    // Resolve certificate name to certificateId if provided
    if (!certificateId && options.certificate) {
      const certificates = await getiOSP12Certificates();
      const cert = certificates.find((c: any) => c.name === options.certificate);
      if (cert) {
        certificateId = cert.id;
      } else {
        throw new ProgramError(`Certificate with name "${options.certificate}" not found.`);
      }
    }

    if (!certificateId) {
      throw new ProgramError('Either certificateId or certificate name is required.');
    }

    const url = extension === 'p12' ? `${ROOTPATH}/v2/certificates/${certificateId}` : `${ROOTPATH}/v1/csr/${certificateId}`
    const response = await appcircleApi.delete(url, {
        headers: getHeaders(),
    });
    return response.data;
  }

  export async function removeKeystore(options: OptionsType<{ keystoreId?: string; keystore?: string }>){
    let keystoreId = options.keystoreId || '';

    // Resolve keystore name to keystoreId if provided
    if (!keystoreId && options.keystore) {
      const keystores = await getAndroidKeystores();
      const ks = keystores.find((k: any) => k.name === options.keystore);
      if (ks) {
        keystoreId = ks.id;
      } else {
        throw new ProgramError(`Keystore with name "${options.keystore}" not found.`);
      }
    }

    if (!keystoreId) {
      throw new ProgramError('Either keystoreId or keystore name is required.');
    }

    const response = await appcircleApi.delete(`${ROOTPATH}/v2/keystores/${keystoreId}`, {
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
  export async function downloadProvisioningProfileById(options: OptionsType<{ provisioningProfileId?: string; provisioningProfile?: string }>, downloadPath: string, fileName:string){
    let provisioningProfileId = options.provisioningProfileId || '';

    // Resolve provisioning profile name to provisioningProfileId if provided
    if (!provisioningProfileId && options.provisioningProfile) {
      const profiles = await getProvisioningProfiles();
      const profile = profiles.find((p: any) => p.name === options.provisioningProfile);
      if (profile) {
        provisioningProfileId = profile.id;
      } else {
        throw new ProgramError(`Provisioning profile with name "${options.provisioningProfile}" not found.`);
      }
    }

    if (!provisioningProfileId) {
      throw new ProgramError('Either provisioningProfileId or provisioning profile name is required.');
    }

    const data = new FormData();
    data.append('Path', downloadPath);
    data.append('Profisioning Profile Id', provisioningProfileId);
    const downloadResponse = await appcircleApi.get(`${ROOTPATH}/v2/provisioning-profiles/${provisioningProfileId}`, {
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
  export async function getProvisioningProfileDetailById(options: OptionsType<{ provisioningProfileId?: string; provisioningProfile?: string }>){
    let provisioningProfileId = options.provisioningProfileId || '';

    // Resolve provisioning profile name to provisioningProfileId if provided
    if (!provisioningProfileId && options.provisioningProfile) {
      const profiles = await getProvisioningProfiles();
      const profile = profiles.find((p: any) => p.name === options.provisioningProfile);
      if (profile) {
        provisioningProfileId = profile.id;
      } else {
        throw new ProgramError(`Provisioning profile with name "${options.provisioningProfile}" not found.`);
      }
    }

    if (!provisioningProfileId) {
      throw new ProgramError('Either provisioningProfileId or provisioning profile name is required.');
    }

    const result = await appcircleApi.get(`${ROOTPATH}/v2/provisioning-profiles/${provisioningProfileId}`, {
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

  export async function removeProvisioningProfile(options: OptionsType<{ provisioningProfileId?: string; provisioningProfile?: string }>){
    let provisioningProfileId = options.provisioningProfileId || '';

    // Resolve provisioning profile name to provisioningProfileId if provided
    if (!provisioningProfileId && options.provisioningProfile) {
      const profiles = await getProvisioningProfiles();
      const profile = profiles.find((p: any) => p.name === options.provisioningProfile);
      if (profile) {
        provisioningProfileId = profile.id;
      } else {
        throw new ProgramError(`Provisioning profile with name "${options.provisioningProfile}" not found.`);
      }
    }

    if (!provisioningProfileId) {
      throw new ProgramError('Either provisioningProfileId or provisioning profile name is required.');
    }

    const response = await appcircleApi.delete(`${ROOTPATH}/v1/provisioning-profiles/${provisioningProfileId}`, {
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