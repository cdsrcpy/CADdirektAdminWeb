using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace CADdirektAdmin.API
{
    internal class EncDec
    {
        public static byte[] Encrypt(byte[] clearData, byte[] Key, byte[] IV)
        {
            using MemoryStream ms = new MemoryStream();
            using Rijndael alg = Rijndael.Create();
            alg.Key = Key;
            alg.IV = IV;

            using (CryptoStream cs = new CryptoStream(ms, alg.CreateEncryptor(), CryptoStreamMode.Write))
            {
                cs.Write(clearData, 0, clearData.Length);
                cs.FlushFinalBlock();
            }

            return ms.ToArray();
        }

        public static string Encrypt(string clearText, string Password)
        {
            byte[] clearBytes = Encoding.Unicode.GetBytes(clearText);
            
            using PasswordDeriveBytes pdb = new PasswordDeriveBytes(Password,
                new byte[] {0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76});

            byte[] encryptedData = Encrypt(clearBytes, pdb.GetBytes(32), pdb.GetBytes(16));

            return Convert.ToBase64String(encryptedData);
        }

        public static byte[] Decrypt(byte[] cipherData, byte[] Key, byte[] IV)
        {
            using MemoryStream ms = new MemoryStream();
            using Rijndael alg = Rijndael.Create();
            alg.Key = Key;
            alg.IV = IV;

            using (CryptoStream cs = new CryptoStream(ms, alg.CreateDecryptor(), CryptoStreamMode.Write))
            {
                cs.Write(cipherData, 0, cipherData.Length);
                cs.FlushFinalBlock();
            }

            return ms.ToArray();
        }

        public static string Decrypt(string cipherText, string Password)
        {
            byte[] cipherBytes = Convert.FromBase64String(cipherText);
            
            using PasswordDeriveBytes pdb = new PasswordDeriveBytes(Password,
                new byte[] {0x49, 0x76, 0x61, 0x6e, 0x20, 0x4d, 0x65, 0x64, 0x76, 0x65, 0x64, 0x65, 0x76});

            byte[] decryptedData = Decrypt(cipherBytes, pdb.GetBytes(32), pdb.GetBytes(16));

            return Encoding.Unicode.GetString(decryptedData);
        }
    }
}
