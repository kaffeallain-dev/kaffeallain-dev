package dev.kaffeallain.mboafit.beta;

import androidx.core.content.ContextCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

@CapacitorPlugin(name = "GoogleAccount")
public class GoogleAccountPlugin extends Plugin {
    @PluginMethod
    public void signIn(PluginCall call) {
        String clientId = call.getString("webClientId");
        if (clientId == null || clientId.trim().isEmpty()) {
            call.reject("Google client is not configured", "not-configured");
            return;
        }

        GetCredentialRequest request = new GetCredentialRequest.Builder()
            .addCredentialOption(new GetSignInWithGoogleOption.Builder(clientId).build())
            .build();

        CredentialManager.create(getActivity()).getCredentialAsync(
            getActivity(), request, null, ContextCompat.getMainExecutor(getActivity()),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse result) {
                    if (!(result.getCredential() instanceof CustomCredential credential)
                        || !GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(credential.getType())) {
                        call.reject("Unexpected Google credential", "sign-in-failed");
                        return;
                    }
                    try {
                        String token = GoogleIdTokenCredential.createFrom(credential.getData()).getIdToken();
                        call.resolve(new JSObject().put("idToken", token));
                    } catch (IllegalArgumentException exception) {
                        call.reject("Invalid Google credential", "sign-in-failed");
                    }
                }

                @Override
                public void onError(GetCredentialException exception) {
                    if (exception instanceof GetCredentialCancellationException) {
                        call.reject("Sign-in cancelled", "cancelled");
                    } else {
                        call.reject("Google account selection unavailable", "sign-in-failed");
                    }
                }
            }
        );
    }

    @PluginMethod
    public void clearSession(PluginCall call) {
        CredentialManager.create(getActivity()).clearCredentialStateAsync(
            new ClearCredentialStateRequest(), null, ContextCompat.getMainExecutor(getActivity()),
            new CredentialManagerCallback<Void, ClearCredentialException>() {
                @Override
                public void onResult(Void ignored) {
                    call.resolve();
                }

                @Override
                public void onError(ClearCredentialException exception) {
                    call.reject("Unable to clear Google account selection", "clear-session-failed");
                }
            }
        );
    }
}
